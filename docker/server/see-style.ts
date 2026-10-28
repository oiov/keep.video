/** 延续官网语义色；私有页面不加载第三方字体、脚本或统计。 */
export const seeStyle = `
:root {
  --paper: #f5f5ef; --surface: #ffffff; --ink: #192326; --muted: #667174;
  --line: #dcded7; --accent: #fb7a42; --track: #e8eae3; --error: #9c3427;
  --warning: #fff0df; --focus: #ba4c1d;
  font-family: "Avenir Next", "PingFang SC", "Microsoft YaHei", sans-serif;
  color: var(--ink); background: var(--paper); font-synthesis: none;
}
* { box-sizing: border-box; }
body { margin: 0; background: radial-gradient(ellipse at 95% 0%, color-mix(in srgb, var(--accent) 7%, transparent), transparent 40%); }
button, input, select { font: inherit; color: inherit; }
button, a, select { -webkit-tap-highlight-color: transparent; }
button, select { cursor: pointer; }
button, input, select, .button { min-height: 44px; border: 1px solid var(--line); border-radius: 7px; background: var(--surface); padding: 10px 14px; }
a { color: inherit; text-underline-offset: 4px; }
button:hover, .button:hover { border-color: var(--muted); }
:focus-visible { outline: 3px solid var(--focus); outline-offset: 4px; }
h1, h2, p { margin: 0; }
h1 { font-size: clamp(29px, 4vw, 38px); font-weight: 650; letter-spacing: -.04em; line-height: 1.35; }
h2 { font-size: 19px; font-weight: 650; margin-bottom: 22px; }
p, li { line-height: 1.8; }
.skip { position: fixed; top: -80px; left: 16px; padding: 12px; background: var(--surface); z-index: 3; }
.skip:focus { top: 12px; }
.header { max-width: 1184px; margin: auto; height: 86px; padding: 0 32px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--line); }
.brand { display: inline-flex; align-items: center; gap: 10px; text-decoration: none; font-weight: 750; font-size: 23px; letter-spacing: -.6px; }
.brand img { width: 31px; height: 31px; }
.header button { background: transparent; font-size: 13px; }
main { max-width: 1184px; margin: auto; padding: 42px 32px 20px; }
.intro { color: var(--muted); font-size: 14px; margin-top: 10px; }
.filters { display: flex; flex-wrap: wrap; align-items: end; gap: 14px; margin: 30px 0 20px; }
label { display: flex; flex-direction: column; gap: 8px; font-size: 12px; color: var(--muted); }
select { min-width: 160px; font-size: 14px; padding-right: 30px; color: var(--ink); }
.primary { background: var(--accent); color: var(--ink); border-color: var(--accent); font-weight: 600; }
.primary:hover { background: color-mix(in srgb, var(--accent) 88%, var(--surface)); border-color: var(--accent); }
.export { padding: 13px 4px; font-size: 13px; margin-left: auto; }
.meta { font-size: 12px; color: var(--muted); display: flex; flex-wrap: wrap; gap: 4px 18px; }
.metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); margin: 26px 0 38px; padding: 28px 0; }
.metric { padding: 0 24px; border-left: 1px solid var(--line); }
.metric:first-child { padding-left: 0; border-left: 0; }
.metric dt { font-size: 13px; color: var(--muted); }
.metric dd { margin: 8px 0; font-size: clamp(29px, 4vw, 44px); line-height: 1.3; letter-spacing: -.04em; font-variant-numeric: tabular-nums; }
.metric p { font-size: 11px; color: var(--muted); letter-spacing: normal; margin-top: 12px; }
.columns { display: grid; grid-template-columns: 1.35fr 1fr; gap: 42px; margin-bottom: 38px; }
.funnel { display: grid; grid-template-columns: 104px minmax(0, 1fr) 48px; align-items: center; gap: 15px 18px; font-size: 13px; }
progress { width: 100%; height: 9px; border: 0; border-radius: 4px; overflow: hidden; background: var(--track); accent-color: var(--accent); }
progress::-webkit-progress-bar { background: var(--track); border-radius: 4px; }
progress::-webkit-progress-value { background: var(--accent); border-radius: 4px; }
progress::-moz-progress-bar { background: var(--accent); border-radius: 4px; }
.number { text-align: right; font-variant-numeric: tabular-nums; }
.note { font-size: 12px; color: var(--muted); margin-top: 19px; }
.delivery { padding: 24px 26px; background: var(--surface); border: 1px solid var(--line); border-radius: 9px; }
.rows { margin: 0; }
.rows div { display: flex; gap: 18px; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--line); font-size: 13px; }
.rows div:last-child { border-bottom: 0; }
.rows dt { color: var(--muted); }
.rows dd { margin: 0; font-weight: 600; font-variant-numeric: tabular-nums; }
.section { margin-bottom: 38px; }
.scroll-table { overflow-x: auto; border-top: 1px solid var(--line); }
table { border-collapse: collapse; width: 100%; font-size: 13px; white-space: nowrap; }
th, td { padding: 14px 12px; border-bottom: 1px solid var(--line); text-align: right; font-variant-numeric: tabular-nums; }
th { font-weight: 500; color: var(--muted); font-size: 12px; }
th:first-child, td:first-child { padding-left: 0; text-align: left; }
th:last-child, td:last-child { padding-right: 0; }
td.empty { text-align: center; color: var(--muted); padding: 36px 10px; }
.notice { background: var(--warning); border-left: 3px solid var(--accent); padding: 13px 17px; margin: 18px 0; font-size: 13px; line-height: 1.8; }
.error { color: var(--error); }
.details { border-top: 1px solid var(--line); padding-top: 20px; font-size: 12px; color: var(--muted); }
summary { cursor: pointer; font-weight: 600; font-size: 13px; color: var(--ink); min-height: 36px; }
.details ul { padding-left: 20px; }
footer { max-width: 1184px; margin: auto; padding: 24px 32px 36px; font-size: 11px; color: var(--muted); }
.login { max-width: 420px; margin: clamp(48px, 12vh, 120px) auto 120px; padding: 0; }
.login form { margin-top: 30px; }
.login input { width: 100%; margin: 0 0 16px; }
.login .primary { width: 100%; }
.login .note { text-align: center; }
.error-page { max-width: 700px; padding-top: 80px; min-height: 60vh; }
.error-page .button { display: inline-flex; align-items: center; margin-top: 20px; text-decoration: none; }
@media (max-width: 720px) {
  .header { height: 72px; padding: 0 20px; }
  main { padding: 28px 20px 12px; }
  .filters { gap: 14px 12px; }
  .filters label { flex: 1 1 calc(50% - 12px); min-width: 0; }
  select { min-width: 0; width: 100%; }
  .filters .primary { flex: 1 1 calc(50% - 12px); }
  .export { margin-left: 0; padding-left: 0; }
  .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px 0; padding: 24px 0; }
  .metric:nth-child(odd) { padding-left: 0; border-left: 0; }
  .metric:nth-child(even) { padding-right: 0; padding-left: 18px; }
  .columns { grid-template-columns: 1fr; gap: 30px; }
  .funnel { grid-template-columns: 96px minmax(0, 1fr) 40px; gap: 16px 12px; }
  .delivery { padding: 22px; }
  footer { padding: 24px 20px; }
  .login { margin: 60px auto 100px; padding: 0 24px; }
}
@media (prefers-reduced-motion: no-preference) {
  main { animation: arrive .25s ease-out; }
  @keyframes arrive { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
}
`
