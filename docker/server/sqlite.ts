import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export const STATE_DATABASE_ID = 0x4b565354
export const ANALYTICS_DATABASE_ID = 0x4b56414e

/** 事务内只能执行同步数据库操作，不能跨网络请求或 await 持有写锁。 */
export function transaction<T>(db: DatabaseSync, run: () => T): T {
  db.exec('BEGIN IMMEDIATE')
  try {
    const result = run()
    db.exec('COMMIT')
    return result
  } catch (error) {
    try { db.exec('ROLLBACK') } catch {}
    throw error
  }
}

export function openDatabase(file: string, applicationId: number, schema: string, analytics = false) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
  try { fs.closeSync(fs.openSync(file, 'wx', 0o600)) }
  catch (error: any) { if (error.code !== 'EEXIST') throw error }
  fs.chmodSync(file, 0o600)
  const db = new DatabaseSync(file)
  try {
    db.exec(`PRAGMA busy_timeout = ${analytics ? 50 : 1000}; PRAGMA foreign_keys = ON`)
    const version = Number(db.prepare('PRAGMA user_version').get()!.user_version)
    const id = Number(db.prepare('PRAGMA application_id').get()!.application_id)
    if (version !== 0 && (version !== 1 || id !== applicationId)) throw new Error('数据库版本不受支持，请使用兼容版本或恢复备份')
    if (version === 0 && (id !== 0 || db.prepare("SELECT name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").get())) {
      throw new Error('数据库类型不匹配，不会覆盖现有数据')
    }
    if (db.prepare('PRAGMA quick_check(1)').get()!.quick_check !== 'ok') throw new Error('数据库校验失败，请恢复备份')
    if (db.prepare('PRAGMA journal_mode = WAL').get()!.journal_mode !== 'wal') throw new Error('数据库需要支持 WAL 的本地持久化卷')
    db.exec(`PRAGMA synchronous = ${analytics ? 'NORMAL' : 'FULL'}`)
    if (version === 0) transaction(db, () => {
      db.exec(schema)
      db.exec(`PRAGMA application_id = ${applicationId}; PRAGMA user_version = 1`)
    })
    return db
  } catch (error) { db.close(); throw error }
}

export function openReadOnlyDatabase(file: string, applicationId: number) {
  const db = new DatabaseSync(file, { readOnly: true })
  try {
    db.exec('PRAGMA busy_timeout = 1000; PRAGMA query_only = ON')
    if (db.prepare('PRAGMA user_version').get()!.user_version !== 1 || db.prepare('PRAGMA application_id').get()!.application_id !== applicationId) {
      throw new Error('数据库版本或类型不受支持')
    }
    return db
  } catch (error) { db.close(); throw error }
}
