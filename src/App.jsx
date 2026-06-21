import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  FileText, Sparkles, Download, Upload, Check, X, AlertTriangle,
  RefreshCw, ChevronRight, Eye, Layers, History, Mail, MessageSquare,
  Loader2, FileDown, RotateCcw, Target, ShieldCheck, ScanLine, Trash2, Pencil
} from "lucide-react";
import { createClient } from "@supabase/supabase-js";

// Supabase client (URL + anon key are public; set as VITE_ env vars). Null until configured.
const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = (SB_URL && SB_ANON) ? createClient(SB_URL, SB_ANON) : null;

/* ------------------------------------------------------------------ */
/*  Styles (single source of truth — reused for on-screen + PDF export) */
/* ------------------------------------------------------------------ */
const CSS = `
:root{
  --ink:#1B2430; --ink-soft:#39424F; --muted:#5C6470; --faint:#8A8F98;
  --paper:#EDEFEA; --card:#FFFFFF; --card-2:#FBFAF6;
  --line:#DEDCD3; --line-2:#E9E7DF;
  --green:#2F6F5E; --green-tint:#E3EFE9; --green-ink:#1F4C40;
  --amber:#B6792E; --amber-tint:#F6ECDB;
  --red:#A4453A; --red-tint:#F3E4E1;
  --radius:14px; --radius-sm:9px;
  --shadow:0 1px 2px rgba(27,36,48,.06),0 10px 30px -16px rgba(27,36,48,.22);
  --sans:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  --serif:Georgia,"Times New Roman",serif;
  --mono:ui-monospace,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace;
}
*{box-sizing:border-box}
.rb-root{font-family:var(--sans);color:var(--ink);background:var(--paper);min-height:100%;}
.rb-wrap{max-width:1180px;margin:0 auto;padding:22px 20px 80px;}

/* header */
.rb-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:6px;flex-wrap:wrap;}
.rb-brand{display:flex;align-items:center;gap:12px;}
.rb-mark{width:38px;height:38px;border-radius:11px;background:var(--ink);color:#fff;display:grid;place-items:center;flex:none;}
.rb-brand h1{font-size:18px;margin:0;letter-spacing:-.01em;font-weight:700;}
.rb-brand p{margin:1px 0 0;font-size:12px;color:var(--muted);}
.rb-steps{display:flex;gap:6px;flex-wrap:wrap;}
.rb-step{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--muted);background:var(--card);border:1px solid var(--line-2);padding:6px 11px;border-radius:999px;}
.rb-step.done{color:var(--green-ink);border-color:var(--green);background:var(--green-tint);}
.rb-dot{width:7px;height:7px;border-radius:50%;background:var(--line);}
.rb-step.done .rb-dot{background:var(--green);}

.rb-grid{display:grid;grid-template-columns:minmax(0,400px) minmax(0,1fr);gap:18px;align-items:start;margin-top:14px;}
@media (max-width:900px){.rb-grid{grid-template-columns:1fr;}}

.rb-card{background:var(--card);border:1px solid var(--line-2);border-radius:var(--radius);box-shadow:var(--shadow);overflow:hidden;}
.rb-card + .rb-card{margin-top:16px;}
.rb-ch{padding:15px 18px 0;display:flex;align-items:flex-start;gap:11px;}
.rb-ch .ico{width:30px;height:30px;border-radius:9px;background:var(--card-2);border:1px solid var(--line-2);display:grid;place-items:center;color:var(--ink-soft);flex:none;margin-top:1px;}
.rb-ch h2{font-size:14.5px;margin:0;font-weight:650;}
.rb-ch .eyebrow{font-size:10.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--faint);font-weight:600;margin:0 0 2px;font-family:var(--sans);}
.rb-cb{padding:13px 18px 18px;}

textarea.rb-ta,input.rb-in{width:100%;font-family:var(--sans);font-size:13.5px;color:var(--ink);background:var(--card-2);border:1px solid var(--line);border-radius:var(--radius-sm);padding:11px 12px;resize:vertical;line-height:1.5;}
textarea.rb-ta:focus,input.rb-in:focus{outline:2px solid var(--green);outline-offset:1px;border-color:var(--green);background:#fff;}
.rb-row2{display:flex;gap:10px;}
.rb-row2 > *{flex:1;min-width:0;}
.rb-lbl{font-size:11.5px;color:var(--muted);margin:0 0 5px;font-weight:550;}

.rb-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;font-family:var(--sans);font-size:13px;font-weight:600;border-radius:var(--radius-sm);padding:10px 15px;border:1px solid transparent;cursor:pointer;transition:transform .04s ease,background .15s ease,border-color .15s ease;}
.rb-btn:active{transform:translateY(1px);}
.rb-btn:disabled{opacity:.5;cursor:not-allowed;}
.rb-btn-pri{background:var(--ink);color:#fff;}
.rb-btn-pri:hover:not(:disabled){background:#0f1620;}
.rb-btn-acc{background:var(--green);color:#fff;}
.rb-btn-acc:hover:not(:disabled){background:#255949;}
.rb-btn-ghost{background:var(--card-2);color:var(--ink-soft);border-color:var(--line);}
.rb-btn-ghost:hover:not(:disabled){border-color:var(--ink-soft);}
.rb-btn-sm{padding:7px 11px;font-size:12px;}
.rb-btn-block{width:100%;}

.rb-saved{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--green-ink);margin-top:10px;}
.rb-hint{font-size:12px;color:var(--muted);margin:9px 0 0;line-height:1.5;}
.rb-up{display:flex;align-items:center;gap:9px;margin-top:11px;flex-wrap:wrap;}
.rb-banner{font-size:12px;color:var(--amber);background:var(--amber-tint);border:1px solid #e7d2ab;border-radius:9px;padding:8px 11px;margin:0 0 12px;display:flex;gap:8px;align-items:flex-start;line-height:1.45;}
.rb-err{font-size:12.5px;color:var(--red);background:var(--red-tint);border:1px solid #e3c2bc;border-radius:9px;padding:9px 12px;margin-top:11px;display:flex;gap:8px;align-items:flex-start;line-height:1.45;}

/* templates picker */
.rb-tpls{display:grid;grid-template-columns:1fr 1fr;gap:11px;}
.rb-tpl{text-align:left;border:1.5px solid var(--line);background:var(--card-2);border-radius:11px;padding:11px;cursor:pointer;transition:border-color .15s ease,background .15s ease;}
.rb-tpl:hover{border-color:var(--ink-soft);}
.rb-tpl.sel{border-color:var(--green);background:var(--green-tint);}
.rb-tpl .nm{font-size:13px;font-weight:650;display:flex;align-items:center;justify-content:space-between;gap:6px;}
.rb-tpl .ds{font-size:11px;color:var(--muted);margin:3px 0 9px;line-height:1.4;}
.rb-mini{height:62px;border-radius:6px;background:#fff;border:1px solid var(--line-2);padding:7px 8px;overflow:hidden;}
.rb-mini .ln{height:3px;border-radius:2px;background:#d9d7cf;margin:3px 0;}
.rb-mini .ln.t{width:46%;background:#9aa0a6;height:5px;margin-bottom:5px;}
.rb-mini .ln.h{width:30%;background:#b9bdc2;}
.rb-mini.center{text-align:center;}
.rb-mini.center .ln{margin-left:auto;margin-right:auto;}
.rb-mini.serif .ln.t{background:#8d8378;}
.rb-mini.acc .ln.h{background:var(--green);}

/* results */
.rb-empty{background:var(--card);border:1px dashed var(--line);border-radius:var(--radius);padding:46px 28px;text-align:center;color:var(--muted);box-shadow:var(--shadow);}
.rb-empty .big{width:54px;height:54px;border-radius:15px;background:var(--card-2);border:1px solid var(--line-2);display:grid;place-items:center;margin:0 auto 14px;color:var(--ink-soft);}
.rb-empty h3{margin:0 0 6px;font-size:16px;color:var(--ink);font-weight:650;}
.rb-empty p{margin:0;font-size:13px;max-width:380px;margin:0 auto;line-height:1.55;}

.rb-tabs{display:flex;gap:4px;background:var(--card);border:1px solid var(--line-2);border-radius:12px;padding:5px;box-shadow:var(--shadow);overflow-x:auto;}
.rb-tab{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:550;color:var(--muted);background:transparent;border:none;border-radius:8px;padding:8px 12px;cursor:pointer;white-space:nowrap;}
.rb-tab.on{background:var(--ink);color:#fff;}
.rb-tab:hover:not(.on){color:var(--ink);}

.rb-panel{margin-top:14px;animation:rise .28s ease;}
@keyframes rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}

.rb-toolbar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:12px;}
.rb-toggle{display:flex;background:var(--card);border:1px solid var(--line-2);border-radius:9px;padding:3px;gap:2px;}
.rb-toggle button{font-size:12px;font-weight:550;color:var(--muted);background:transparent;border:none;border-radius:7px;padding:7px 11px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;}
.rb-toggle button.on{background:var(--green-tint);color:var(--green-ink);}
.rb-dlrow{display:flex;gap:8px;flex-wrap:wrap;}

.rb-pageinfo{font-size:12px;color:var(--muted);display:flex;align-items:center;gap:8px;margin-bottom:10px;}
.rb-pagebar{flex:1;max-width:200px;height:6px;border-radius:4px;background:var(--line-2);overflow:hidden;}
.rb-pagebar i{display:block;height:100%;background:var(--green);}

/* resume sheet */
.sheet-scroll{overflow:auto;}
.sheet{background:#fff;color:#15181d;width:100%;max-width:780px;margin:0 auto;padding:42px 48px;box-shadow:var(--shadow);border:1px solid var(--line-2);border-radius:6px;font-family:var(--serif);font-size:13.4px;line-height:1.5;}
.sheet .r-header{margin-bottom:4px;}
.sheet .r-name{font-size:25px;letter-spacing:.01em;margin:0 0 2px;font-weight:700;}
.sheet .r-title{font-size:13.4px;margin:0 0 7px;color:#2b3038;}
.sheet .r-contact{font-size:11.6px;color:#3a3f47;margin:0 0 6px;}
.sheet .r-h2{font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;border-bottom:1.5px solid #15181d;padding-bottom:3px;margin:15px 0 7px;}
.sheet p.r-sum{margin:0 0 4px;}
.sheet .r-skills{margin:0;}
.sheet .r-block{break-inside:avoid;margin-bottom:9px;}
.sheet .r-rowline{display:flex;justify-content:space-between;gap:14px;align-items:baseline;}
.sheet .r-role{font-weight:700;}
.sheet .r-sub{color:#3a3f47;font-size:12.6px;}
.sheet .r-dates{white-space:nowrap;color:#3a3f47;font-size:11.8px;flex:none;}
.sheet ul{margin:4px 0 6px;padding-left:18px;}
.sheet li{margin:2.5px 0;}
.sheet[contenteditable="true"]{outline:2px dashed var(--green);outline-offset:7px;border-radius:4px;}
.sheet[contenteditable="true"]:focus{outline-color:var(--green-ink);}
/* template variants */
.tpl-modern{font-family:var(--sans);font-size:13px;}
.tpl-modern .r-h2{color:var(--green-ink);border-bottom-color:var(--green);letter-spacing:.16em;}
.tpl-modern .r-title{color:var(--green-ink);font-weight:600;}
.tpl-compact{font-family:var(--sans);font-size:12px;line-height:1.42;padding:34px 40px;}
.tpl-compact .r-h2{margin:11px 0 5px;}
.tpl-compact ul{margin:3px 0 5px;}
.tpl-compact .r-name{font-size:22px;}
.tpl-compact .r-block{margin-bottom:7px;}
.tpl-executive{font-family:"Hoefler Text","Iowan Old Style","Garamond",Georgia,serif;font-size:13.4px;}
.tpl-executive .r-header{text-align:center;}
.tpl-executive .r-name{font-size:27px;letter-spacing:.05em;}
.tpl-executive .r-h2{text-align:center;border-bottom:1px solid #15181d;border-top:1px solid #15181d;padding:4px 0;letter-spacing:.2em;text-transform:uppercase;}
/* additional templates */
.tpl-minimal{font-family:var(--sans);font-size:12.9px;}
.tpl-minimal .r-name{font-weight:600;letter-spacing:.01em;}
.tpl-minimal .r-h2{border-bottom:none;color:var(--muted);letter-spacing:.24em;font-size:10.5px;font-weight:600;margin:18px 0 6px;}
.tpl-minimal .r-block{margin-bottom:11px;}
.tpl-corporate{font-family:var(--sans);font-size:13px;}
.tpl-corporate .r-name{color:#13243a;font-weight:700;}
.tpl-corporate .r-title{color:#2c3e57;}
.tpl-corporate .r-header{border-bottom:2px solid #13243a;padding-bottom:9px;margin-bottom:6px;}
.tpl-corporate .r-h2{border-bottom:1.5px solid #13243a;color:#13243a;letter-spacing:.08em;}
.tpl-refined{font-family:"Palatino Linotype","Book Antiqua","Iowan Old Style",Georgia,serif;font-size:13.4px;}
.tpl-refined .r-name{font-size:24px;letter-spacing:.02em;}
.tpl-refined .r-h2{border-bottom:none;border-top:1px solid #cfcabb;padding-top:6px;text-transform:none;font-variant:small-caps;letter-spacing:.1em;font-size:14px;}
.tpl-accent{font-family:var(--sans);font-size:13px;}
.tpl-accent .r-name{color:#13243a;}
.tpl-accent .r-h2{border-bottom:none;border-left:4px solid var(--green);padding:1px 0 1px 9px;letter-spacing:.1em;color:var(--green-ink);}

/* ATS view */
.ats-view{font-family:var(--mono);font-size:12px;line-height:1.75;color:var(--ink-soft);white-space:pre-wrap;background:var(--card-2);border:1px solid var(--line-2);border-radius:11px;padding:20px 20px;max-width:780px;margin:0 auto;}
.ats-view mark{background:var(--green-tint);color:var(--green-ink);padding:0 2px;border-radius:3px;}

/* analysis */
.rb-gauges{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;}
@media (max-width:560px){.rb-gauges{grid-template-columns:1fr;}}
.rb-gauge{background:var(--card);border:1px solid var(--line-2);border-radius:13px;padding:16px;display:flex;align-items:center;gap:14px;box-shadow:var(--shadow);}
.rb-gauge .num{font-family:var(--serif);font-size:30px;font-weight:700;line-height:1;}
.rb-gauge .meta .k{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--faint);font-weight:600;}
.rb-gauge .meta .v{font-size:12.5px;color:var(--muted);margin-top:2px;}

.rb-sec{background:var(--card);border:1px solid var(--line-2);border-radius:13px;padding:16px 18px;box-shadow:var(--shadow);margin-top:13px;}
.rb-sec h4{margin:0 0 10px;font-size:13.5px;font-weight:650;display:flex;align-items:center;gap:8px;}
.rb-sec h4 .cnt{font-size:11px;color:var(--muted);font-weight:500;background:var(--card-2);border:1px solid var(--line-2);padding:1px 8px;border-radius:999px;}
.chips{display:flex;flex-wrap:wrap;gap:6px;}
.chip{font-family:var(--mono);font-size:11.5px;padding:4px 9px;border-radius:7px;border:1px solid var(--line-2);background:var(--card-2);color:var(--ink-soft);}
.chip.ok{background:var(--green-tint);border-color:#bcdccf;color:var(--green-ink);}
.chip.miss{background:var(--amber-tint);border-color:#e7d2ab;color:var(--amber);}
.rb-list{list-style:none;margin:0;padding:0;}
.rb-list li{font-size:13px;line-height:1.5;padding:7px 0;border-bottom:1px solid var(--line-2);display:flex;gap:9px;align-items:flex-start;color:var(--ink-soft);}
.rb-list li:last-child{border-bottom:none;}
.rb-list li .mk{flex:none;margin-top:2px;}
.rb-list li b{color:var(--ink);font-weight:600;}
.badge{font-size:10.5px;font-weight:650;padding:2px 7px;border-radius:6px;text-transform:uppercase;letter-spacing:.04em;flex:none;}
.badge.yes{background:var(--green-tint);color:var(--green-ink);}
.badge.partial{background:var(--amber-tint);color:var(--amber);}
.badge.no{background:var(--red-tint);color:var(--red);}
.checkrow{display:flex;align-items:center;gap:9px;font-size:12.5px;padding:6px 0;color:var(--ink-soft);}
.checkrow .ic{width:18px;height:18px;border-radius:5px;display:grid;place-items:center;flex:none;}
.checkrow .ic.pass{background:var(--green-tint);color:var(--green-ink);}
.checkrow .ic.fail{background:var(--red-tint);color:var(--red);}

/* improve / suggestions */
.sug-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px;}
.sug-scores{display:flex;gap:8px;}
.sug-pill{font-size:12px;font-weight:600;padding:5px 11px;border-radius:999px;background:var(--card);border:1px solid var(--line-2);color:var(--ink-soft);display:inline-flex;align-items:center;gap:6px;}
.sug-pill b{font-family:var(--serif);font-size:15px;}
.sug-card{background:var(--card);border:1px solid var(--line-2);border-radius:13px;padding:14px 16px;box-shadow:var(--shadow);margin-bottom:11px;transition:opacity .15s ease;}
.sug-card.accepted{border-color:var(--green);background:var(--green-tint);}
.sug-card.rejected{opacity:.5;}
.sug-meta{display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;}
.sug-sec{font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:3px 8px;border-radius:6px;background:var(--card-2);border:1px solid var(--line-2);color:var(--ink-soft);}
.sug-verify{font-size:10.5px;font-weight:600;padding:3px 8px;border-radius:6px;background:var(--amber-tint);color:var(--amber);}
.sug-reason{font-size:12px;color:var(--muted);}
.sug-text{font-size:13px;line-height:1.5;color:var(--ink);background:var(--card-2);border:1px solid var(--line-2);border-radius:8px;padding:10px 12px;margin:0 0 10px;}
.sug-card.accepted .sug-text{background:#fff;}
.sug-old{font-size:12px;color:var(--muted);text-decoration:line-through;margin:0 0 6px;}
.sug-actions{display:flex;gap:8px;align-items:center;}
.sug-applied{font-size:12px;color:var(--green-ink);font-weight:600;display:inline-flex;align-items:center;gap:6px;margin-right:auto;}
/* cover + interview */
.proseout{font-size:13.5px;line-height:1.65;color:var(--ink-soft);white-space:pre-wrap;background:var(--card);border:1px solid var(--line-2);border-radius:13px;padding:20px 22px;box-shadow:var(--shadow);}

/* history */
.histrow{display:flex;align-items:center;gap:12px;justify-content:space-between;padding:12px 14px;border:1px solid var(--line-2);border-radius:11px;background:var(--card);margin-bottom:9px;flex-wrap:wrap;}
.histrow .info .t{font-size:13.5px;font-weight:600;}
.histrow .info .s{font-size:11.5px;color:var(--muted);margin-top:2px;}
.histrow .sc{display:flex;gap:7px;}
.scpill{font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px;background:var(--card-2);border:1px solid var(--line-2);color:var(--ink-soft);}
.histacts{display:flex;gap:6px;}

/* inline suggestions on the resume */
.isug{margin:7px 0 11px;border:1px solid #bcdccf;background:var(--green-tint);border-radius:9px;padding:9px 11px;font-family:var(--sans);}
.isug-top{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:10px;letter-spacing:.05em;text-transform:uppercase;font-weight:700;color:var(--green-ink);margin-bottom:5px;}
.isug-old{font-size:11.5px;color:var(--muted);text-decoration:line-through;text-decoration-color:var(--red);margin:0 0 4px;line-height:1.4;}
.isug-text{font-size:12.6px;color:var(--ink);line-height:1.5;margin:0;}
.isug-actions{display:flex;gap:7px;margin-top:9px;}
.isug-actions button{font-family:var(--sans);font-size:11.5px;font-weight:650;border-radius:7px;padding:5px 12px;cursor:pointer;border:1px solid transparent;}
.isug-accept{background:var(--green);color:#fff;}
.isug-accept:hover{background:#255949;}
.isug-reject{background:#fff;color:var(--ink-soft);border-color:var(--line);}
.isug-reject:hover{border-color:var(--ink-soft);}
.r-flag{background:#fdf2d2;box-shadow:0 0 0 3px #fdf2d2;border-radius:3px;}

.spin{animation:spin 1s linear infinite;}
@keyframes spin{to{transform:rotate(360deg)}}
.loadbox{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 20px;gap:14px;color:var(--muted);background:var(--card);border:1px solid var(--line-2);border-radius:var(--radius);box-shadow:var(--shadow);}
.loadbox .stg{font-size:13px;font-weight:550;color:var(--ink-soft);}
.loadbox .sub{font-size:12px;}

:focus-visible{outline:2px solid var(--green);outline-offset:2px;border-radius:4px;}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important;}}

/* print → isolate the resume sheet only */
@media print{
  @page{size:Letter;margin:0.55in;}
  html,body{background:#fff!important;}
  body *{visibility:hidden!important;}
  .print-area,.print-area *{visibility:visible!important;}
  .print-area{position:absolute;left:0;top:0;width:100%;}
  .sheet{box-shadow:none!important;border:none!important;outline:none!important;border-radius:0!important;margin:0!important;max-width:none!important;width:100%!important;padding:0!important;}
  .no-print{display:none!important;}
  .sheet .r-flag{background:transparent!important;box-shadow:none!important;}
  .sheet .r-block{break-inside:auto!important;}        /* allow long roles to flow across the page break — no big empty footer */
  .sheet .r-h2,.sheet .r-rowline{break-after:avoid;}   /* keep section/role headings attached to what follows */
  .sheet li{break-inside:avoid;}                        /* never split a single bullet across pages */
  .sheet ul{orphans:2;widows:2;}
}
`;

/* ------------------------------------------------------------------ */
/*  Templates                                                          */
/* ------------------------------------------------------------------ */
const TEMPLATES = [
  { id: "classic",   name: "Classic",   cls: "tpl-classic",   desc: "Serif, conservative. Safe for finance, law, academia.", mini: ["serif"] },
  { id: "modern",    name: "Modern",    cls: "tpl-modern",    desc: "Clean sans with a quiet accent. Great for tech & product.", mini: ["acc"] },
  { id: "compact",   name: "Compact",   cls: "tpl-compact",   desc: "Tighter spacing to fit dense experience on two pages.", mini: [] },
  { id: "executive", name: "Executive", cls: "tpl-executive", desc: "Centered, refined serif for senior & leadership roles.", mini: ["serif", "center"] },
  { id: "minimal",   name: "Minimalist", cls: "tpl-minimal",   desc: "Airy sans, no rules. Understated and very clean.", mini: [] },
  { id: "corporate", name: "Corporate",  cls: "tpl-corporate", desc: "Sans with navy accents and firm rules. Classic US corporate.", mini: ["acc"] },
  { id: "refined",   name: "Refined",    cls: "tpl-refined",   desc: "Left serif with small-caps headings. Polished and senior.", mini: ["serif"] },
  { id: "accent",    name: "Accent",     cls: "tpl-accent",    desc: "Sans with a colored bar on each heading. Modern and scannable.", mini: ["acc"] },
];

/* ------------------------------------------------------------------ */
/*  Storage wrapper (persists across sessions; degrades gracefully)    */
/* ------------------------------------------------------------------ */
const hasStore = typeof window !== "undefined" && window.storage && typeof window.storage.get === "function";
const hasLS = (() => { try { localStorage.setItem("__rt__", "1"); localStorage.removeItem("__rt__"); return true; } catch { return false; } })();
const mem = {};
const store = {
  available: hasStore || hasLS,
  async get(k){
    if(hasStore){ try { return await window.storage.get(k); } catch { return null; } }
    if(hasLS){ try { const v = localStorage.getItem(k); return v === null ? null : { value: v }; } catch { return null; } }
    return k in mem ? { value: mem[k] } : null;
  },
  async set(k,v){
    if(hasStore){ try { return await window.storage.set(k,v); } catch { return null; } }
    if(hasLS){ try { localStorage.setItem(k, v); return { value: v }; } catch { return null; } }
    mem[k] = v; return { value: v };
  },
};

/* ------------------------------------------------------------------ */
/*  Claude API helpers (Claude-in-Claude)                              */
/* ------------------------------------------------------------------ */
async function callClaude(system, userText){
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system,
      messages: [{ role: "user", content: userText }],
    }),
  });
  if(!res.ok) throw new Error("Request failed (" + res.status + ")");
  const data = await res.json();
  const text = (data.content || []).map(b => (b && b.type === "text" ? b.text : "")).join("");
  if(!text) throw new Error("Empty response");
  return text;
}
function parseJSON(s){
  if(!s) return null;
  let t = s.trim().replace(/^```(?:json)?/i, "").replace(/```$/,"").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if(a !== -1 && b !== -1 && b > a) t = t.slice(a, b+1);
  try { return JSON.parse(t); }
  catch { try { return JSON.parse(t.replace(/,\s*([}\]])/g, "$1")); } catch { return null; } }
}
async function withRetry(fn, n=1){ let e; for(let i=0;i<=n;i++){ try { return await fn(); } catch(err){ e=err; } } throw e; }

/* ------------------------------------------------------------------ */
/*  Prompts                                                            */
/* ------------------------------------------------------------------ */
const SYS_JD = `You are an expert U.S. technical recruiter and ATS analyst. Read the job description and extract its structured requirements.
Return ONLY minified JSON (no markdown, no commentary) with keys:
jobTitle (string), company (string or ""), seniority (string), hardSkills (string[]), tools (string[]), softSkills (string[]),
keywords (string[]: the 16-24 most ATS-relevant terms a parser would scan for, ranked by importance, using the JD's own wording),
qualifications (string[]: concrete must-have / nice-to-have requirements), responsibilities (string[]: top 6).
Keep arrays concise and deduplicated.`;

const SYS_TAILOR = `You are an elite U.S. resume writer who produces ATS-optimized, recruiter-friendly resumes.
Rewrite the candidate's MASTER RESUME to target the role described in the JD ANALYSIS.
HARD RULES:
1) NEVER invent employers, job titles, dates, degrees, certifications, metrics, tools, or experience that are not present in the master resume. You may rephrase, reorder, emphasize, and tighten ONLY facts already present. If the master lacks a JD requirement, do NOT fabricate it — leave it out.
2) Integrate relevant keywords from the analysis naturally, only where the candidate genuinely has the experience. No keyword stuffing.
3) Achievement-focused bullets: strong past-tense action verb + concrete action + measurable result/impact when the master provides it. Specific, human, concise. Avoid clichés and AI-sounding filler ("responsible for", "leveraged synergies", "results-driven professional").
4) Pull the real name and contact details from the master resume; use "" for anything missing.
5) Fill roughly two pages. Make the resume SUBSTANTIAL — do not over-condense. The summary and skills sections in particular must be rich, never minimal.
6) SUMMARY: write a strong 4-5 sentence professional summary that opens with the candidate's title/seniority and years of experience, names their core domains, weaves in the most important JD keywords they genuinely match, and closes on the value they bring. Specific and confident, never generic filler.
7) SKILLS: be comprehensive — list 14-22 of the candidate's REAL skills (hard skills, tools, platforms, frameworks, methods, domain knowledge) that align with the JD, ordered by JD relevance. Pull skills evidenced anywhere in the master resume, not just from an existing skills line.
Return ONLY minified JSON with keys:
name, title (a target-aligned professional title grounded in the candidate's real experience),
contact { email, phone, location, links (string[]) },
summary (a rich 4-5 sentence factual professional summary, per rule 6),
coreSkills (string[]: 14-22 relevant skills per rule 7, ordered by JD relevance),
experience (array of { company, role, location, start, end, bullets (string[] of 4-6 tailored bullets) }),
projects (array of { name, detail, tech (string[]) } — only if present in the master, else []),
education (array of { credential, school, location, year }),
certifications (string[]),
additional (string[]: e.g. languages, awards, publications — only if present, else []).
Output compact JSON only.`;

const SYS_ASSESS = `You are an honest ATS optimization analyst. Given the JD ANALYSIS and the TAILORED RESUME, assess fit truthfully.
Do NOT claim the candidate has skills that are not evidenced in the tailored resume.
Return ONLY minified JSON with keys:
qualifications (array of { requirement, met: "yes"|"partial"|"no", note }),
missingSkills (string[]: JD-relevant skills/keywords absent from the resume that the candidate should add IF they truly have them, or upskill toward),
sectionSuggestions (array of { section, suggestion } — concrete, actionable, per section),
changeSummary { addedKeywords (string[]), strengthenedBullets (string[]: short descriptions of which bullets were improved and how), deemphasized (string[]: content reduced or removed and why), alignment (string[]: how the resume now maps to the role) },
remainingGaps (string[]).
Be specific.`;

const SYS_COVER = `Write a concise, professional U.S. cover letter for the target role using ONLY facts from the TAILORED RESUME and JD ANALYSIS.
Follow this EXACT format and nothing else:
Line 1: Hi Hiring Team
(blank line)
2-3 short body paragraphs, each separated by a blank line.
(blank line)
Best regards,
(the candidate's full name from the resume, on its own line)

Body rules: ~250 words total. Warm, specific, confident. Open with genuine fit, give one or two concrete proof points drawn from the resume, close with a forward-looking line. No clichés, no fabricated details, no flattery padding, no markdown, no bracketed placeholders, no subject line, no address block, no date.`;

const SYS_INTERVIEW = `You are an interview coach. Generate preparation material grounded ONLY in the TAILORED RESUME and JD ANALYSIS.
Return ONLY minified JSON with keys:
strengths (string[]: top selling points to emphasize),
likelyQuestions (array of { question, angle } — 6-8 items; angle = how to answer using the candidate's real experience),
gapsToAddress (array of { gap, strategy } — how to honestly handle requirements the resume does not fully meet),
storiesToTell (string[]: specific experiences from the resume to develop into STAR stories).`;

const SYS_SUGGEST = `You are an ATS optimization assistant. Given the JD ANALYSIS and the current TAILORED RESUME, propose concrete, ready-to-apply improvements that would raise the resume's keyword match and ATS score.
RULES:
- Prefer rephrasing/strengthening existing content and weaving in missing JD keywords where the candidate plausibly already has the experience.
- Do NOT fabricate. If a suggestion asserts a new skill, tool, or experience the resume doesn't already show, set "needsVerification": true so the user can confirm it's true before accepting.
- Each suggestion must be specific and self-contained (real text the user can drop straight in), in the candidate's voice, achievement-focused, no clichés.
- Use the candidate's REAL company names from the resume for experience suggestions.
Return ONLY minified JSON, an object: { "suggestions": [ {
  "id": <short unique string>,
  "section": "summary" | "skills" | "experience" | "projects" | "certifications",
  "company": <for experience suggestions: the exact company name from the resume; else "">,
  "action": "rewrite_summary" | "add_skill" | "add_bullet" | "replace_bullet" | "add_project" | "add_certification",
  "oldText": <for replace_bullet ONLY: the exact existing bullet to replace; else "">,
  "text": <the suggested content: a full rewritten summary; a single skill term; one achievement bullet; a project name; a certification name>,
  "keywords": [<JD keywords this adds or strengthens>],
  "reason": <one short sentence: why it helps the match/ATS>,
  "needsVerification": <true if it claims something new the user must confirm, else false>
} ] }
Give 7-12 high-impact suggestions spread across summary, skills, the key experience entries, projects, and missing keywords. Prioritize the keywords the JD weights most.`;

/* ------------------------------------------------------------------ */
/*  Scoring (deterministic — transparent, not magic numbers)           */
/* ------------------------------------------------------------------ */
function normalize(s){ return (s||"").toLowerCase().replace(/[^a-z0-9+#.\s-]/g," ").replace(/\s+/g," ").trim(); }
function resumeToText(r){
  if(!r) return "";
  const p = [r.name, r.title, r.summary];
  if(Array.isArray(r.coreSkills)) p.push(r.coreSkills.join(" "));
  (r.experience||[]).forEach(e => { p.push(e.role, e.company, e.location); (e.bullets||[]).forEach(b => p.push(b)); });
  (r.projects||[]).forEach(pr => { p.push(pr.name, pr.detail); if(Array.isArray(pr.tech)) p.push(pr.tech.join(" ")); });
  (r.education||[]).forEach(ed => p.push(ed.credential, ed.school));
  if(Array.isArray(r.certifications)) p.push(r.certifications.join(" "));
  if(Array.isArray(r.additional)) p.push(r.additional.join(" "));
  return normalize(p.filter(Boolean).join(" "));
}
function keywordPresent(text, kw){
  const k = normalize(kw); if(!k) return false;
  if(text.includes(k)) return true;
  if(k.endsWith("s") && text.includes(k.slice(0,-1))) return true;
  const toks = k.split(" ").filter(t => t.length > 2);
  if(toks.length > 1 && toks.every(t => text.includes(t))) return true;
  return false;
}
function buildCoverage(analysis, tailored){
  const set = new Set([...(analysis.keywords||[]), ...(analysis.hardSkills||[]), ...(analysis.tools||[])].map(x => String(x).trim()).filter(Boolean));
  const kws = Array.from(set);
  const text = resumeToText(tailored);
  const covered = [], missing = [];
  kws.forEach(k => (keywordPresent(text, k) ? covered : missing).push(k));
  const coverage = kws.length ? Math.round((covered.length / kws.length) * 100) : 0;
  return { covered, missing, coverage, total: kws.length };
}
function buildScores(coverage, assess){
  const quals = (assess && assess.qualifications) || [];
  const q = quals.length
    ? quals.reduce((a,x) => a + (x.met === "yes" ? 1 : x.met === "partial" ? 0.5 : 0), 0) / quals.length
    : coverage.coverage / 100;
  const match = Math.round(0.6 * coverage.coverage + 0.4 * q * 100);
  return { match };
}
function atsChecklist(tailored, pages){
  const c = tailored.contact || {};
  const checks = [
    { ok: !!c.email, label: "Parseable contact details (email present)" },
    { ok: !!tailored.summary && (tailored.experience||[]).length > 0 && (tailored.education||[]).length > 0, label: "Standard sections detected (summary, experience, education)" },
    { ok: (tailored.coreSkills||[]).length > 0, label: "Dedicated skills section for keyword matching" },
    { ok: true, label: "Single-column layout (no tables, columns, or text boxes)" },
    { ok: true, label: "No images, icons, or graphics in parsed content" },
    { ok: true, label: "Standard fonts and plain bullet characters" },
    { ok: pages == null ? true : (pages >= 1.25 && pages <= 2.5), label: pages == null ? "Length within ATS-friendly range" : "Length within range (" + pages.toFixed(1) + " pages)" },
  ];
  const passed = checks.filter(x => x.ok).length;
  return { checks, score: Math.round((passed / checks.length) * 100) };
}
function escapeRe(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// Applies one accepted suggestion to a copy of the resume data (non-destructive).
function applySuggestion(tailored, s){
  const t = JSON.parse(JSON.stringify(tailored));
  if(s.action === "rewrite_summary"){ t.summary = s.text; }
  else if(s.action === "add_skill"){
    t.coreSkills = t.coreSkills || [];
    if(!t.coreSkills.some(x => String(x).toLowerCase() === String(s.text).toLowerCase())) t.coreSkills.push(s.text);
  }
  else if(s.action === "add_certification"){ t.certifications = t.certifications || []; t.certifications.push(s.text); }
  else if(s.action === "add_project"){ t.projects = t.projects || []; t.projects.push({ name: s.text, detail: s.detail || "", tech: s.keywords || [] }); }
  else if(s.action === "add_bullet" || s.action === "replace_bullet"){
    const roles = t.experience || [];
    let idx = roles.findIndex(r => (r.company || "").toLowerCase() === (s.company || "").toLowerCase());
    if(idx === -1) idx = 0;
    if(roles[idx]){
      roles[idx].bullets = roles[idx].bullets || [];
      if(s.action === "replace_bullet" && s.oldText){
        const bi = roles[idx].bullets.findIndex(b => b.trim() === s.oldText.trim());
        if(bi !== -1) roles[idx].bullets[bi] = s.text; else roles[idx].bullets.push(s.text);
      } else {
        roles[idx].bullets.push(s.text);
      }
    }
  }
  return t;
}
function applyAll(tailored, list){ return (list || []).reduce((acc, s) => applySuggestion(acc, s), tailored); }

/* ------------------------------------------------------------------ */
/*  Resume rendering (used on-screen + captured for PDF/HTML export)   */
/* ------------------------------------------------------------------ */
const SUG_LABELS = { rewrite_summary: "Suggested rewrite", add_skill: "Add skill", add_bullet: "Add achievement", replace_bullet: "Stronger bullet", add_project: "Add project", add_certification: "Add certification" };
function InlineSug({ s, onAccept, onReject }){
  return (
    <div className="isug no-print" contentEditable={false} suppressContentEditableWarning={true}>
      <div className="isug-top"><Sparkles size={11} /> {SUG_LABELS[s.action] || "Suggestion"}{s.reason ? " · " + s.reason : ""}{s.needsVerification ? <span className="sug-verify">verify</span> : null}</div>
      {s.action === "replace_bullet" && s.oldText ? <div className="isug-old">{s.oldText}</div> : null}
      <div className="isug-text">{s.text}</div>
      {Array.isArray(s.keywords) && s.keywords.length ? <div className="chips" style={{ marginTop: 7 }}>{s.keywords.map((k, i) => <span className="chip ok" key={i}>{k}</span>)}</div> : null}
      <div className="isug-actions">
        <button className="isug-accept" onClick={() => onAccept(s)}>Accept</button>
        <button className="isug-reject" onClick={() => onReject(s)}>Reject</button>
      </div>
    </div>
  );
}
function Sheet({ data, tplCls, innerRef, editing, review }){
  if(!data) return null;
  const c = data.contact || {};
  const contactBits = [c.email, c.phone, c.location, ...((c.links)||[])].filter(Boolean).join("   |   ");
  const norm = (x) => (x || "").trim().toLowerCase();
  const rv = (review && review.on) ? review : null;
  const sugFor = (pred) => rv ? rv.pending.filter(pred) : [];
  const exp = data.experience || [];
  const A = rv ? rv.onAccept : null, R = rv ? rv.onReject : null;
  const roleSugs = (e, i) => sugFor(s => (s.action === "add_bullet" || s.action === "replace_bullet") && (norm(s.company) === norm(e.company) || (i === 0 && !exp.some(r => norm(r.company) === norm(s.company)))));
  const sumSugs = sugFor(s => s.action === "rewrite_summary");
  const skillSugs = sugFor(s => s.action === "add_skill");
  const projSugs = sugFor(s => s.action === "add_project");
  const certSugs = sugFor(s => s.action === "add_certification");
  return (
    <div className={"sheet " + tplCls} ref={innerRef} contentEditable={!!editing} suppressContentEditableWarning={true}>
      <div className="r-header">
        {data.name ? <div className="r-name">{data.name}</div> : null}
        {data.title ? <div className="r-title">{data.title}</div> : null}
        {contactBits ? <div className="r-contact">{contactBits}</div> : null}
      </div>

      {(data.summary || sumSugs.length) ? (<>
        <div className="r-h2">Professional Summary</div>
        {data.summary ? <p className="r-sum">{data.summary}</p> : null}
        {sumSugs.map(s => <InlineSug key={s.id} s={s} onAccept={A} onReject={R} />)}
      </>) : null}

      {((data.coreSkills||[]).length || skillSugs.length) ? (<>
        <div className="r-h2">Core Skills</div>
        {(data.coreSkills||[]).length ? <p className="r-skills">{data.coreSkills.join(",  ")}</p> : null}
        {skillSugs.map(s => <InlineSug key={s.id} s={s} onAccept={A} onReject={R} />)}
      </>) : null}

      {exp.length ? (<>
        <div className="r-h2">Professional Experience</div>
        {exp.map((e,i) => (
          <div className="r-block" key={i}>
            <div className="r-rowline">
              <div><span className="r-role">{e.role}</span>{e.company ? <span className="r-sub"> — {e.company}{e.location ? ", " + e.location : ""}</span> : null}</div>
              <div className="r-dates">{[e.start, e.end].filter(Boolean).join(" – ")}</div>
            </div>
            {(e.bullets||[]).length ? <ul>{e.bullets.map((b,j) => {
              const flagged = rv && rv.pending.some(s => s.action === "replace_bullet" && norm(s.company) === norm(e.company) && norm(s.oldText) === norm(b));
              return <li key={j} className={flagged ? "r-flag" : undefined}>{b}</li>;
            })}</ul> : null}
            {roleSugs(e,i).map(s => <InlineSug key={s.id} s={s} onAccept={A} onReject={R} />)}
          </div>
        ))}
      </>) : null}

      {((data.projects||[]).length || projSugs.length) ? (<>
        <div className="r-h2">Projects</div>
        {(data.projects||[]).map((p,i) => (
          <div className="r-block" key={i}>
            <div><span className="r-role">{p.name}</span>{Array.isArray(p.tech) && p.tech.length ? <span className="r-sub"> — {p.tech.join(", ")}</span> : null}</div>
            {p.detail ? <ul><li>{p.detail}</li></ul> : null}
          </div>
        ))}
        {projSugs.map(s => <InlineSug key={s.id} s={s} onAccept={A} onReject={R} />)}
      </>) : null}

      {(data.education||[]).length ? (<>
        <div className="r-h2">Education</div>
        {data.education.map((ed,i) => (
          <div className="r-block" key={i}>
            <div className="r-rowline">
              <div><span className="r-role">{ed.credential}</span>{ed.school ? <span className="r-sub"> — {ed.school}{ed.location ? ", " + ed.location : ""}</span> : null}</div>
              <div className="r-dates">{ed.year}</div>
            </div>
          </div>
        ))}
      </>) : null}

      {((data.certifications||[]).length || certSugs.length) ? (<>
        <div className="r-h2">Certifications</div>
        {(data.certifications||[]).length ? <ul>{data.certifications.map((x,i) => <li key={i}>{x}</li>)}</ul> : null}
        {certSugs.map(s => <InlineSug key={s.id} s={s} onAccept={A} onReject={R} />)}
      </>) : null}

      {(data.additional||[]).length ? (<>
        <div className="r-h2">Additional</div>
        <ul>{data.additional.map((x,i) => <li key={i}>{x}</li>)}</ul>
      </>) : null}
    </div>
  );
}

function resumePlainText(d){
  if(!d) return "";
  const L = [];
  if(d.name) L.push(d.name);
  if(d.title) L.push(d.title);
  const c = d.contact || {};
  const cb = [c.email, c.phone, c.location, ...((c.links)||[])].filter(Boolean).join("  |  ");
  if(cb) L.push(cb);
  if(d.summary){ L.push("", "PROFESSIONAL SUMMARY", d.summary); }
  if((d.coreSkills||[]).length){ L.push("", "CORE SKILLS", d.coreSkills.join(", ")); }
  if((d.experience||[]).length){
    L.push("", "PROFESSIONAL EXPERIENCE");
    d.experience.forEach(e => {
      L.push(`${e.role||""} — ${e.company||""}${e.location ? ", "+e.location : ""}  (${[e.start,e.end].filter(Boolean).join(" – ")})`);
      (e.bullets||[]).forEach(b => L.push("• " + b));
    });
  }
  if((d.projects||[]).length){
    L.push("", "PROJECTS");
    d.projects.forEach(p => { L.push(`${p.name||""}${Array.isArray(p.tech)&&p.tech.length ? " — "+p.tech.join(", ") : ""}`); if(p.detail) L.push("• " + p.detail); });
  }
  if((d.education||[]).length){ L.push("", "EDUCATION"); d.education.forEach(ed => L.push(`${ed.credential||""} — ${ed.school||""}${ed.location ? ", "+ed.location : ""}  ${ed.year||""}`)); }
  if((d.certifications||[]).length){ L.push("", "CERTIFICATIONS"); d.certifications.forEach(x => L.push("• " + x)); }
  if((d.additional||[]).length){ L.push("", "ADDITIONAL"); d.additional.forEach(x => L.push("• " + x)); }
  return L.join("\n");
}
function HighlightedText({ text, keywords }){
  const kws = (keywords||[]).map(k => String(k).trim()).filter(k => k.length > 1).sort((a,b) => b.length - a.length);
  if(!kws.length) return <>{text}</>;
  const re = new RegExp("(" + kws.map(escapeRe).join("|") + ")", "gi");
  const parts = text.split(re);
  return <>{parts.map((p,i) => re.test(p) && i % 2 === 1 ? <mark key={i}>{p}</mark> : <React.Fragment key={i}>{p}</React.Fragment>)}</>;
}

/* ------------------------------------------------------------------ */
/*  Small UI atoms                                                     */
/* ------------------------------------------------------------------ */
function Gauge({ value, label, sub, Icon }){
  const tone = value >= 80 ? "var(--green)" : value >= 55 ? "var(--amber)" : "var(--red)";
  return (
    <div className="rb-gauge">
      <div className="num" style={{ color: tone }}>{value}<span style={{ fontSize: 14, color: "var(--faint)" }}>%</span></div>
      <div className="meta">
        <div className="k">{label}</div>
        <div className="v" style={{ display:"flex", alignItems:"center", gap:6 }}><Icon size={13} />{sub}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
function ResumeApp(){
  const [master, setMaster] = useState("");
  const [masterSaved, setMasterSaved] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [tpl, setTpl] = useState("modern");
  const [jd, setJd] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [company, setCompany] = useState("");

  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // {analysis, tailored, assess, coverage, scores}
  const [tab, setTab] = useState("resume");
  const [view, setView] = useState("recruiter"); // recruiter | ats
  const [pages, setPages] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editedHTML, setEditedHTML] = useState(null);

  const [cover, setCover] = useState("");
  const [coverBusy, setCoverBusy] = useState(false);
  const [copiedCover, setCopiedCover] = useState(false);
  const [histQuery, setHistQuery] = useState("");
  const [prep, setPrep] = useState(null);
  const [prepBusy, setPrepBusy] = useState(false);

  const [suggestions, setSuggestions] = useState([]);   // raw suggestions from AI
  const [acceptedSugs, setAcceptedSugs] = useState([]); // accepted suggestion objects (applied to resume)
  const [rejectedIds, setRejectedIds] = useState([]);   // dismissed suggestion ids
  const [sugBusy, setSugBusy] = useState(false);
  const [showSug, setShowSug] = useState(false);     // show inline suggestions on the resume tab

  const [versions, setVersions] = useState([]);
  const [currentVid, setCurrentVid] = useState(null); // id of the history entry for this session
  const [cmp, setCmp] = useState([]); // up to 2 version ids to compare

  const sheetRef = useRef(null);
  const fileRef = useRef(null);

  /* load persisted state once */
  useEffect(() => {
    (async () => {
      const m = await store.get("master_resume");
      if(m && m.value){ const v = JSON.parse(m.value); setMaster(v.text||""); setSavedAt(v.at||null); setMasterSaved(!!(v.text||"").trim()); }
      const t = await store.get("selected_template"); if(t && t.value) setTpl(JSON.parse(t.value));
      const vs = await store.get("resume_versions"); if(vs && vs.value){ try { setVersions(JSON.parse(vs.value)||[]); } catch {} }
    })();
  }, []);

  /* estimate page count from rendered sheet height */
  useEffect(() => {
    if(!sheetRef.current || view !== "recruiter" || !result){ return; }
    const h = sheetRef.current.scrollHeight; // px at 96dpi
    const pagePx = (11 - 2 * 0.55) * 96; // Letter height minus print margins
    setPages(h / pagePx);
  }, [result, tpl, view, editedHTML, acceptedSugs]);

  // keep this session's saved history entry in sync with accepted suggestions / length changes
  useEffect(() => {
    if(!currentVid || !result) return;
    const applied = applyAll(result.tailored, acceptedSugs);
    const cov2 = buildCoverage(result.analysis || {}, applied);
    const sc2 = buildScores(cov2, result.assess || {});
    setVersions(prev => {
      if(!prev.some(v => v.id === currentVid)) return prev;
      const next = prev.map(v => v.id === currentVid ? { ...v, tailored: applied, match: sc2.match, coverage: cov2.coverage } : v);
      store.set("resume_versions", JSON.stringify(next));
      return next;
    });
  }, [acceptedSugs, currentVid]);

  const saveMaster = useCallback(async () => {
    const at = Date.now();
    await store.set("master_resume", JSON.stringify({ text: master, at }));
    setSavedAt(at); setMasterSaved(true);
  }, [master]);

  const pickTemplate = async (id) => { setTpl(id); await store.set("selected_template", JSON.stringify(id)); };

  const onFile = async (file) => {
    if(!file) return;
    setError("");
    const name = file.name.toLowerCase();
    try {
      if(name.endsWith(".docx")){
        const mammoth = await import("mammoth");
        const buf = await file.arrayBuffer();
        const out = await (mammoth.extractRawText ? mammoth.extractRawText({ arrayBuffer: buf }) : mammoth.default.extractRawText({ arrayBuffer: buf }));
        setMaster(out.value || "");
      } else if(name.endsWith(".pdf")){
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        const buf = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: buf }).promise;
        let text = "";
        for(let i=1;i<=pdf.numPages;i++){
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map(it => (it && typeof it.str === "string" ? it.str : "")).join(" ") + "\n";
        }
        if(!text.trim()) { setError("This looks like a scanned/image PDF (no selectable text). Upload a .docx/.txt or paste the text instead."); return; }
        setMaster(text.trim());
      } else if(name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".markdown")){
        setMaster(await file.text());
      } else {
        setError("That file type can't be read here. Upload .pdf / .docx / .txt, or paste the text directly.");
        return;
      }
      setMasterSaved(false);
    } catch {
      setError("Couldn't read that file. Try pasting the resume text instead.");
    }
  };

  const saveVersion = async (entry) => {
    const next = [entry, ...versions].slice(0, 12);
    setVersions(next);
    await store.set("resume_versions", JSON.stringify(next));
  };

  const optimize = async () => {
    if(!master.trim() || !jd.trim()) return;
    setBusy(true); setError(""); setResult(null); setCover(""); setPrep(null); setPages(null); setEditedHTML(null); setEditing(false); setSuggestions([]); setAcceptedSugs([]); setRejectedIds([]); setShowSug(false);
    try {
      setStage("Reading the job description");
      const analysis = parseJSON(await withRetry(() => callClaude(SYS_JD, jd)));
      if(!analysis) throw new Error("Could not analyze the job description. Try again.");

      setStage("Tailoring your resume to the role");
      const tailored = parseJSON(await withRetry(() => callClaude(
        SYS_TAILOR,
        `MASTER RESUME:\n${master}\n\nJD ANALYSIS:\n${JSON.stringify(analysis)}`
      )));
      if(!tailored) throw new Error("Could not generate the tailored resume. Try again.");

      setStage("Scoring fit and checking ATS readiness");
      const assess = parseJSON(await withRetry(() => callClaude(
        SYS_ASSESS,
        `JD ANALYSIS:\n${JSON.stringify(analysis)}\n\nTAILORED RESUME:\n${JSON.stringify(tailored)}`
      ))) || {};

      const coverage = buildCoverage(analysis, tailored);
      const scores = buildScores(coverage, assess);
      const res = { analysis, tailored, assess, coverage, scores };
      setResult(res);
      setTab("resume"); setView("recruiter");

      const at = Date.now();
      setCurrentVid(at);
      saveVersion({
        id: at,
        at,
        jobTitle: jobTitle || analysis.jobTitle || "Untitled role",
        company: company || analysis.company || "",
        tpl,
        match: scores.match,
        coverage: coverage.coverage,
        tailored,
        analysisKeywords: analysis.keywords || [],
      });
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      setBusy(false); setStage("");
    }
  };

  const adjustLength = async (dir) => {
    if(!result) return;
    setBusy(true); setError(""); setStage(dir === "expand" ? "Expanding toward a full two pages" : "Tightening the resume");
    try {
      const directive = dir === "expand"
        ? "\n\nLENGTH DIRECTIVE: The current resume is under two pages. Expand it to fill roughly two full pages by adding more detail and additional achievement bullets DRAWN ONLY from facts already present in the master resume. Do not invent anything."
        : "\n\nLENGTH DIRECTIVE: The current resume runs long. Tighten it to fit cleanly within two pages by trimming the least JD-relevant content and merging weaker bullets. Keep the strongest, most relevant material.";
      const tailored = parseJSON(await withRetry(() => callClaude(
        SYS_TAILOR,
        `MASTER RESUME:\n${master}\n\nJD ANALYSIS:\n${JSON.stringify(result.analysis)}${directive}`
      )));
      if(!tailored) throw new Error("Could not adjust the length. Try again.");
      const assess = parseJSON(await withRetry(() => callClaude(
        SYS_ASSESS, `JD ANALYSIS:\n${JSON.stringify(result.analysis)}\n\nTAILORED RESUME:\n${JSON.stringify(tailored)}`
      ))) || {};
      const coverage = buildCoverage(result.analysis, tailored);
      const scores = buildScores(coverage, assess);
      setResult({ ...result, tailored, assess, coverage, scores });
      setEditedHTML(null); setEditing(false); setSuggestions([]); setAcceptedSugs([]); setRejectedIds([]); setShowSug(false);
    } catch (e) { setError(e.message || "Couldn't adjust length."); }
    finally { setBusy(false); setStage(""); }
  };

  const genCover = async () => {
    if(!result) return;
    setCoverBusy(true); setError("");
    try {
      const current = applyAll(result.tailored, acceptedSugs);
      const txt = await withRetry(() => callClaude(
        SYS_COVER, `JD ANALYSIS:\n${JSON.stringify(result.analysis)}\n\nTAILORED RESUME:\n${JSON.stringify(current)}`
      ));
      setCover(txt.trim());
    } catch (e) { setError(e.message || "Couldn't generate the cover letter."); }
    finally { setCoverBusy(false); }
  };
  const copyCover = async () => {
    try { await navigator.clipboard.writeText(cover); setCopiedCover(true); setTimeout(() => setCopiedCover(false), 1500); }
    catch { setError("Couldn't copy automatically — select the text and copy manually."); }
  };
  const downloadCover = () => {
    const name = (result?.tailored?.name || "cover-letter").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const role = (jobTitle || result?.analysis?.jobTitle || "role").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const blob = new Blob([cover], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${name}-${role}-cover-letter.txt`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const genPrep = async () => {
    if(!result) return;
    setPrepBusy(true); setError("");
    try {
      const current = applyAll(result.tailored, acceptedSugs);
      const p = parseJSON(await withRetry(() => callClaude(
        SYS_INTERVIEW, `JD ANALYSIS:\n${JSON.stringify(result.analysis)}\n\nTAILORED RESUME:\n${JSON.stringify(current)}`
      )));
      if(!p) throw new Error("Could not generate interview prep. Try again.");
      setPrep(p);
    } catch (e) { setError(e.message || "Couldn't generate interview prep."); }
    finally { setPrepBusy(false); }
  };

  const genSuggestions = async () => {
    if(!result) return;
    setSugBusy(true); setError("");
    try {
      const current = applyAll(result.tailored, acceptedSugs);
      const out = parseJSON(await withRetry(() => callClaude(
        SYS_SUGGEST, `JD ANALYSIS:\n${JSON.stringify(result.analysis)}\n\nTAILORED RESUME:\n${JSON.stringify(current)}`
      )));
      const list = (out && Array.isArray(out.suggestions)) ? out.suggestions : (Array.isArray(out) ? out : []);
      if(!list.length) throw new Error("Could not generate suggestions. Try again.");
      // give every suggestion a stable id
      const withIds = list.map((s, i) => ({ ...s, id: s.id ? String(s.id) : ("sug-" + i + "-" + Date.now()) }));
      setSuggestions(withIds); setRejectedIds([]); setShowSug(true); setEditing(false); setEditedHTML(null);
    } catch (e) { setError(e.message || "Couldn't generate suggestions."); }
    finally { setSugBusy(false); }
  };

  const acceptSug = (s) => {
    setAcceptedSugs(prev => prev.some(x => x.id === s.id) ? prev : [...prev, s]);
    setRejectedIds(prev => prev.filter(id => id !== s.id));
    setEditedHTML(null); setEditing(false); // applying re-renders from data
  };
  const rejectSug = (s) => {
    setAcceptedSugs(prev => prev.filter(x => x.id !== s.id));
    setRejectedIds(prev => prev.includes(s.id) ? prev : [...prev, s.id]);
  };
  const undoSug = (s) => {
    setAcceptedSugs(prev => prev.filter(x => x.id !== s.id));
    setEditedHTML(null); setEditing(false);
  };

  const downloadPDF = () => { window.print(); };
  const toggleEdit = () => {
    if (sheetRef.current) setEditedHTML(sheetRef.current.innerHTML); // snapshot current content (structured or edited)
    setEditing(e => !e); setShowSug(false);
  };
  const toggleSug = () => { setShowSug(v => !v); setEditing(false); setEditedHTML(null); };
  const downloadHTML = () => {
    if(!sheetRef.current) return;
    const name = (result?.tailored?.name || "resume").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const role = (jobTitle || result?.analysis?.jobTitle || "role").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name} resume</title><style>${CSS}\nbody{background:#fff;margin:0;padding:24px;}@media print{body{padding:0}}</style></head><body><div class="print-area">${sheetRef.current.outerHTML}</div></body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${name}-${role}-resume.html`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const restoreVersion = (v) => {
    const coverage = buildCoverage({ keywords: v.analysisKeywords }, v.tailored);
    setResult({
      analysis: { keywords: v.analysisKeywords, jobTitle: v.jobTitle, company: v.company },
      tailored: v.tailored,
      assess: {},
      coverage,
      scores: { match: v.match },
    });
    setJobTitle(v.jobTitle === "Untitled role" ? "" : v.jobTitle);
    setCompany(v.company || "");
    setTpl(v.tpl || tpl);
    setCurrentVid(v.id);
    setTab("resume"); setView("recruiter"); setPages(null); setCover(""); setPrep(null); setEditedHTML(null); setEditing(false); setSuggestions([]); setAcceptedSugs([]); setRejectedIds([]); setShowSug(false);
  };
  const toggleCmp = (id) => setCmp(prev => prev.includes(id) ? prev.filter(x => x !== id) : (prev.length < 2 ? [...prev, id] : [prev[1], id]));

  const tplCls = (TEMPLATES.find(t => t.id === tpl) || TEMPLATES[0]).cls;
  const stepResume = masterSaved && master.trim();
  const stepJD = jd.trim().length > 40;
  const a = result?.analysis; const asx = result?.assess || {};
  const t = result ? applyAll(result.tailored, acceptedSugs) : null;        // resume with accepted suggestions applied
  const cov = (a && t) ? buildCoverage(a, t) : null;                         // live keyword coverage
  const sc = cov ? buildScores(cov, asx) : null;                            // live match score
  const ats = t ? atsChecklist(t, pages) : null;
  const cmpVersions = versions.filter(v => cmp.includes(v.id));
  const pendingSug = suggestions.filter(s => !acceptedSugs.some(x => x.id === s.id) && !rejectedIds.includes(s.id));
  const review = { on: showSug && !editing && editedHTML === null, pending: pendingSug, onAccept: acceptSug, onReject: rejectSug };
  const histQ = histQuery.trim().toLowerCase();
  const shownVersions = histQ ? versions.filter(v => (((v.company || "") + " " + (v.jobTitle || "")).toLowerCase().includes(histQ))) : versions;

  const TABS = [
    { id: "resume", label: "Resume", Icon: FileText },
    { id: "analysis", label: "Analysis", Icon: Target },
    { id: "improve", label: "Improve", Icon: Sparkles },
    { id: "cover", label: "Cover letter", Icon: Mail },
    { id: "prep", label: "Interview prep", Icon: MessageSquare },
    { id: "history", label: "History", Icon: History },
  ];

  return (
    <div className="rb-root">
      <style>{CSS}</style>
      <div className="rb-wrap">

        {/* header */}
        <div className="rb-head no-print">
          <div className="rb-brand">
            <div className="rb-mark"><Sparkles size={20} /></div>
            <div>
              <h1>Resume Tailor</h1>
              <p>Match your resume to any U.S. job — ATS-ready, recruiter-friendly, factual.</p>
            </div>
          </div>
          <div className="rb-steps">
            <span className={"rb-step" + (stepResume ? " done" : "")}><span className="rb-dot" />Master resume</span>
            <span className={"rb-step" + (tpl ? " done" : "")}><span className="rb-dot" />Template</span>
            <span className={"rb-step" + (stepJD ? " done" : "")}><span className="rb-dot" />Job description</span>
          </div>
        </div>

        {!store.available && (
          <div className="rb-banner no-print" style={{ marginTop: 12 }}>
            <AlertTriangle size={15} style={{ flex: "none", marginTop: 1 }} />
            <span>Persistent saving isn't available here, so your master resume and version history stay only for this session.</span>
          </div>
        )}

        <div className="rb-grid">
          {/* LEFT: inputs */}
          <div className="no-print">
            {/* master resume */}
            <div className="rb-card">
              <div className="rb-ch">
                <div className="ico"><FileText size={16} /></div>
                <div><div className="eyebrow">Step 1</div><h2>Your master resume</h2></div>
              </div>
              <div className="rb-cb">
                <textarea
                  className="rb-ta" rows={8}
                  placeholder="Paste your full master resume here — every role, project, skill, and achievement. This is your source of truth; nothing outside it will ever be invented."
                  value={master}
                  onChange={(e) => { setMaster(e.target.value); setMasterSaved(false); }}
                />
                <div className="rb-up">
                  <button className="rb-btn rb-btn-ghost rb-btn-sm" onClick={() => fileRef.current && fileRef.current.click()}>
                    <Upload size={14} /> Upload .pdf / .docx / .txt
                  </button>
                  <input ref={fileRef} type="file" accept=".pdf,.docx,.txt,.md,.markdown" style={{ display: "none" }} onChange={(e) => onFile(e.target.files && e.target.files[0])} />
                  <button className="rb-btn rb-btn-acc rb-btn-sm" onClick={saveMaster} disabled={!master.trim()}>
                    <Check size={14} /> Save master resume
                  </button>
                </div>
                {masterSaved && savedAt && (
                  <div className="rb-saved"><ShieldCheck size={14} /> Saved{store.available ? " — kept across sessions" : ""} · {new Date(savedAt).toLocaleString()}</div>
                )}
              </div>
            </div>

            {/* template */}
            <div className="rb-card">
              <div className="rb-ch">
                <div className="ico"><Layers size={16} /></div>
                <div><div className="eyebrow">Step 2</div><h2>Choose a template</h2></div>
              </div>
              <div className="rb-cb">
                <div className="rb-tpls">
                  {TEMPLATES.map(tp => (
                    <button key={tp.id} className={"rb-tpl" + (tpl === tp.id ? " sel" : "")} onClick={() => pickTemplate(tp.id)}>
                      <div className="nm">{tp.name}{tpl === tp.id && <Check size={14} style={{ color: "var(--green)" }} />}</div>
                      <div className="ds">{tp.desc}</div>
                      <div className={"rb-mini " + tp.mini.join(" ")}>
                        <div className="ln t" /><div className="ln" /><div className="ln h" /><div className="ln" /><div className="ln" style={{ width: "70%" }} />
                      </div>
                    </button>
                  ))}
                </div>
                <p className="rb-hint">All eight are single-column and parser-safe. They differ in type and spacing — never in ATS compatibility.</p>
              </div>
            </div>

            {/* JD */}
            <div className="rb-card">
              <div className="rb-ch">
                <div className="ico"><Target size={16} /></div>
                <div><div className="eyebrow">Step 3</div><h2>Paste the job description</h2></div>
              </div>
              <div className="rb-cb">
                <div className="rb-row2" style={{ marginBottom: 10 }}>
                  <div><div className="rb-lbl">Job title (optional)</div><input className="rb-in" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Senior Data Analyst" /></div>
                  <div><div className="rb-lbl">Company (optional)</div><input className="rb-in" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Northwind" /></div>
                </div>
                <textarea
                  className="rb-ta" rows={7}
                  placeholder="Paste the full job description — responsibilities, requirements, and qualifications. The more complete, the better the keyword match."
                  value={jd} onChange={(e) => setJd(e.target.value)}
                />
                <button className="rb-btn rb-btn-pri rb-btn-block" style={{ marginTop: 12 }} onClick={optimize}
                  disabled={busy || !master.trim() || !jd.trim()}>
                  {busy ? <><Loader2 size={15} className="spin" /> Working…</> : <><Sparkles size={15} /> Optimize resume</>}
                </button>
                {!master.trim() && <p className="rb-hint">Add your master resume above to begin.</p>}
                {error && <div className="rb-err"><AlertTriangle size={15} style={{ flex: "none", marginTop: 1 }} />{error}</div>}
              </div>
            </div>
          </div>

          {/* RIGHT: results */}
          <div>
            {busy && !result && (
              <div className="loadbox no-print">
                <Loader2 size={26} className="spin" style={{ color: "var(--green)" }} />
                <div className="stg">{stage || "Working…"}</div>
                <div className="sub">Three quick passes: analyze · tailor · score.</div>
              </div>
            )}

            {!busy && !result && (
              <div className="rb-empty no-print">
                <div className="big"><FileText size={26} /></div>
                <h3>Your tailored resume appears here</h3>
                <p>Save your master resume, pick a template, and paste a job description. You'll get an optimized two-page resume, a match score, an ATS check, keyword coverage, and a full change summary.</p>
              </div>
            )}

            {result && (
              <>
                <div className="rb-tabs no-print">
                  {TABS.map(({ id, label, Icon }) => (
                    <button key={id} className={"rb-tab" + (tab === id ? " on" : "")} onClick={() => setTab(id)}>
                      <Icon size={14} /> {label}
                    </button>
                  ))}
                </div>

                {/* RESUME TAB */}
                {tab === "resume" && (
                  <div className="rb-panel">
                    <div className="rb-toolbar no-print">
                      <div className="rb-toggle">
                        <button className={view === "recruiter" ? "on" : ""} onClick={() => setView("recruiter")}><Eye size={13} /> Recruiter view</button>
                        <button className={view === "ats" ? "on" : ""} onClick={() => setView("ats")}><ScanLine size={13} /> ATS view</button>
                      </div>
                      <div className="rb-dlrow">
                        {suggestions.length === 0 ? (
                          <button className="rb-btn rb-btn-acc rb-btn-sm" onClick={genSuggestions} disabled={sugBusy || view !== "recruiter"}>{sugBusy ? <><Loader2 size={13} className="spin" /> Finding…</> : <><Sparkles size={13} /> Suggest improvements</>}</button>
                        ) : (
                          <>
                            <button className={"rb-btn rb-btn-sm " + (showSug ? "rb-btn-acc" : "rb-btn-ghost")} onClick={toggleSug} disabled={view !== "recruiter"}><Sparkles size={13} /> Suggestions{pendingSug.length ? " (" + pendingSug.length + ")" : ""}</button>
                            <button className="rb-btn rb-btn-ghost rb-btn-sm" onClick={genSuggestions} disabled={sugBusy || view !== "recruiter"} title="Regenerate suggestions">{sugBusy ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />}</button>
                          </>
                        )}
                        <button className={"rb-btn rb-btn-sm " + (editing ? "rb-btn-acc" : "rb-btn-ghost")} onClick={toggleEdit} disabled={view !== "recruiter"}><Pencil size={13} /> {editing ? "Done editing" : "Edit text"}</button>
                        <button className="rb-btn rb-btn-ghost rb-btn-sm" onClick={() => adjustLength("expand")} disabled={busy || editing}><RefreshCw size={13} /> Fuller</button>
                        <button className="rb-btn rb-btn-ghost rb-btn-sm" onClick={() => adjustLength("condense")} disabled={busy || editing}><RefreshCw size={13} /> Tighter</button>
                        <button className="rb-btn rb-btn-ghost rb-btn-sm" onClick={downloadHTML}><FileDown size={13} /> HTML</button>
                        <button className="rb-btn rb-btn-acc rb-btn-sm" onClick={downloadPDF}><Download size={13} /> Download PDF</button>
                      </div>
                    </div>

                    {view === "recruiter" && pages != null && (
                      <div className="rb-pageinfo no-print">
                        <span>≈ {pages.toFixed(1)} of 2 pages</span>
                        <span className="rb-pagebar"><i style={{ width: Math.min(100, (pages / 2) * 100) + "%" }} /></span>
                        <span>{pages < 1.75 ? "Use “Fuller” to reach two pages." : pages > 2.15 ? "Use “Tighter” to fit two pages." : "Nicely filled."}</span>
                      </div>
                    )}
                    {busy && <div className="rb-pageinfo no-print"><Loader2 size={13} className="spin" /> {stage}…</div>}

                    {editing && view === "recruiter" && (
                      <div className="rb-banner no-print"><Pencil size={15} style={{ flex: "none", marginTop: 1 }} />Click anywhere in the resume to change or add text, then hit Download PDF. (Switching template, adjusting length, or regenerating clears manual edits.)</div>
                    )}

                    {review.on && (
                      <div className="rb-banner no-print" style={{ background: "var(--green-tint)", borderColor: "#bcdccf", color: "var(--green-ink)" }}>
                        <Sparkles size={15} style={{ flex: "none", marginTop: 1 }} />
                        {pendingSug.length
                          ? <span>The highlighted cards below show what to change and where — Accept what's true for you, Reject the rest. Live score: <b>Match {sc ? sc.match : 0}%</b> · <b>Keywords {cov ? cov.coverage : 0}%</b>{acceptedSugs.length ? ` · ${acceptedSugs.length} applied` : ""}. Items tagged “verify” add something new — only accept if you genuinely have it.</span>
                          : <span>All suggestions reviewed — <b>Match {sc ? sc.match : 0}%</b> · <b>Keywords {cov ? cov.coverage : 0}%</b>. Hit the ↻ button for a fresh round, or download your resume.</span>}
                      </div>
                    )}

                    {view === "recruiter" ? (
                      <div className="print-area">
                        <div className="sheet-scroll">
                          {editedHTML !== null ? (
                            <div className={"sheet " + tplCls} ref={sheetRef} contentEditable={editing} suppressContentEditableWarning={true} dangerouslySetInnerHTML={{ __html: editedHTML }} />
                          ) : (
                            <Sheet data={t} tplCls={tplCls} innerRef={sheetRef} editing={editing} review={review} />
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="rb-banner no-print"><ScanLine size={15} style={{ flex: "none", marginTop: 1 }} />This is roughly what an ATS extracts. Highlighted terms are job-description keywords it found.</div>
                        <div className="ats-view"><HighlightedText text={resumePlainText(t)} keywords={a?.keywords || []} /></div>
                      </>
                    )}
                    <p className="rb-hint no-print">Tip: in the print dialog, choose “Save as PDF” as the destination. The exported file keeps real, selectable text — exactly what ATS parsers need.</p>
                  </div>
                )}

                {/* ANALYSIS TAB */}
                {tab === "analysis" && (
                  <div className="rb-panel">
                    <div className="rb-gauges">
                      <Gauge value={sc.match} label="Match score" sub="Resume ↔ role fit" Icon={Target} />
                      <Gauge value={ats ? ats.score : 0} label="ATS score" sub="Parser compatibility" Icon={ShieldCheck} />
                      <Gauge value={cov.coverage} label="Keyword coverage" sub={`${cov.covered.length}/${cov.total} terms`} Icon={ScanLine} />
                    </div>

                    <div className="rb-sec">
                      <h4><ScanLine size={15} /> Keyword coverage <span className="cnt">{cov.covered.length}/{cov.total}</span></h4>
                      {cov.covered.length > 0 && <><div className="rb-lbl">Present in your resume</div><div className="chips" style={{ marginBottom: 12 }}>{cov.covered.map((k,i) => <span className="chip ok" key={i}><Check size={11} style={{ verticalAlign: "-1px", marginRight: 3 }} />{k}</span>)}</div></>}
                      {cov.missing.length > 0
                        ? <><div className="rb-lbl">Missing — add only if you truly have them</div><div className="chips">{cov.missing.map((k,i) => <span className="chip miss" key={i}>{k}</span>)}</div></>
                        : <div className="rb-saved" style={{ marginTop: 0 }}><Check size={14} /> Every tracked keyword is covered.</div>}
                    </div>

                    {ats && (
                      <div className="rb-sec">
                        <h4><ShieldCheck size={15} /> ATS compatibility checklist</h4>
                        {ats.checks.map((c,i) => (
                          <div className="checkrow" key={i}>
                            <span className={"ic " + (c.ok ? "pass" : "fail")}>{c.ok ? <Check size={12} /> : <X size={12} />}</span>{c.label}
                          </div>
                        ))}
                      </div>
                    )}

                    {Array.isArray(asx.qualifications) && asx.qualifications.length > 0 && (
                      <div className="rb-sec">
                        <h4><Target size={15} /> Requirement-by-requirement</h4>
                        <ul className="rb-list">
                          {asx.qualifications.map((q,i) => (
                            <li key={i}>
                              <span className={"badge " + (q.met || "no")}>{q.met || "no"}</span>
                              <span><b>{q.requirement}</b>{q.note ? " — " + q.note : ""}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {asx.changeSummary && (
                      <div className="rb-sec">
                        <h4><RefreshCw size={15} /> What changed</h4>
                        {(asx.changeSummary.addedKeywords||[]).length > 0 && <><div className="rb-lbl">Keywords woven in</div><div className="chips" style={{ marginBottom: 12 }}>{asx.changeSummary.addedKeywords.map((k,i) => <span className="chip ok" key={i}>{k}</span>)}</div></>}
                        {(asx.changeSummary.strengthenedBullets||[]).length > 0 && <><div className="rb-lbl">Bullets strengthened</div><ul className="rb-list" style={{ marginBottom: 8 }}>{asx.changeSummary.strengthenedBullets.map((x,i) => <li key={i}><Check size={14} className="mk" style={{ color: "var(--green)" }} />{x}</li>)}</ul></>}
                        {(asx.changeSummary.deemphasized||[]).length > 0 && <><div className="rb-lbl">De-emphasized or removed</div><ul className="rb-list" style={{ marginBottom: 8 }}>{asx.changeSummary.deemphasized.map((x,i) => <li key={i}><X size={14} className="mk" style={{ color: "var(--amber)" }} />{x}</li>)}</ul></>}
                        {(asx.changeSummary.alignment||[]).length > 0 && <><div className="rb-lbl">How it now maps to the role</div><ul className="rb-list">{asx.changeSummary.alignment.map((x,i) => <li key={i}><ChevronRight size={14} className="mk" style={{ color: "var(--ink-soft)" }} />{x}</li>)}</ul></>}
                      </div>
                    )}

                    {Array.isArray(asx.missingSkills) && asx.missingSkills.length > 0 && (
                      <div className="rb-sec">
                        <h4><AlertTriangle size={15} /> Skills to consider adding</h4>
                        <div className="chips">{asx.missingSkills.map((k,i) => <span className="chip miss" key={i}>{k}</span>)}</div>
                        <p className="rb-hint">Add these only where you have real experience — the tool will never invent them for you.</p>
                      </div>
                    )}

                    {Array.isArray(asx.sectionSuggestions) && asx.sectionSuggestions.length > 0 && (
                      <div className="rb-sec">
                        <h4><Layers size={15} /> Section-by-section suggestions</h4>
                        <ul className="rb-list">{asx.sectionSuggestions.map((s,i) => <li key={i}><span className="badge yes" style={{ background: "var(--card-2)", color: "var(--ink-soft)" }}>{s.section}</span><span>{s.suggestion}</span></li>)}</ul>
                      </div>
                    )}

                    {Array.isArray(asx.remainingGaps) && asx.remainingGaps.length > 0 && (
                      <div className="rb-sec">
                        <h4><Target size={15} /> Still worth improving</h4>
                        <ul className="rb-list">{asx.remainingGaps.map((g,i) => <li key={i}><AlertTriangle size={14} className="mk" style={{ color: "var(--amber)" }} />{g}</li>)}</ul>
                      </div>
                    )}
                  </div>
                )}

                {/* IMPROVE TAB */}
                {tab === "improve" && (
                  <div className="rb-panel">
                    <div className="sug-head">
                      <div className="rb-lbl" style={{ margin: 0, maxWidth: 360 }}>Proposed edits to lift your match & ATS score. Accept the ones that are true for you — each one applies to the resume instantly.</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <div className="sug-scores">
                          <span className="sug-pill"><Target size={13} /> Match <b>{sc ? sc.match : 0}%</b></span>
                          <span className="sug-pill"><ScanLine size={13} /> Keywords <b>{cov ? cov.coverage : 0}%</b></span>
                        </div>
                        <button className="rb-btn rb-btn-acc rb-btn-sm" onClick={genSuggestions} disabled={sugBusy}>
                          {sugBusy ? <><Loader2 size={13} className="spin" /> Thinking…</> : <><Sparkles size={13} /> {suggestions.length ? "Regenerate" : "Suggest improvements"}</>}
                        </button>
                      </div>
                    </div>

                    {acceptedSugs.length > 0 && (
                      <div className="rb-saved" style={{ marginTop: 0, marginBottom: 12 }}><Check size={14} /> {acceptedSugs.length} change{acceptedSugs.length > 1 ? "s" : ""} applied — view them in the Resume tab.</div>
                    )}

                    {suggestions.length === 0 && !sugBusy && (
                      <div className="rb-empty"><div className="big"><Sparkles size={24} /></div><h3>No suggestions yet</h3><p>Generate concrete, section-by-section edits — keywords to weave in, stronger bullets, missing skills — then accept or reject each. Your score moves as you go.</p></div>
                    )}

                    {suggestions.length > 0 && (
                      <div className="rb-banner no-print"><AlertTriangle size={15} style={{ flex: "none", marginTop: 1 }} />Only accept what's true for you. Items tagged “verify” claim something new — accept those only if you genuinely have that experience.</div>
                    )}

                    {suggestions.map((s) => {
                      const accepted = acceptedSugs.some(x => x.id === s.id);
                      const rejected = rejectedIds.includes(s.id);
                      const secLabel = s.section === "experience" ? (s.company || "Experience")
                        : s.section === "summary" ? "Summary"
                        : s.section === "skills" ? "Skills"
                        : s.section === "projects" ? "Projects"
                        : s.section === "certifications" ? "Certifications"
                        : (s.section || "Resume");
                      const actLabel = ({
                        rewrite_summary: "Rewrite summary",
                        add_skill: "Add skill",
                        add_bullet: "Add achievement",
                        replace_bullet: "Strengthen bullet",
                        add_project: "Add project",
                        add_certification: "Add certification",
                      })[s.action] || "Update";
                      return (
                        <div className={"sug-card" + (accepted ? " accepted" : rejected ? " rejected" : "")} key={s.id}>
                          <div className="sug-meta">
                            <span className="sug-sec">{secLabel}</span>
                            <span className="sug-reason">{actLabel}{s.reason ? " · " + s.reason : ""}</span>
                            {s.needsVerification && <span className="sug-verify">verify</span>}
                          </div>
                          {s.action === "replace_bullet" && s.oldText ? <p className="sug-old">{s.oldText}</p> : null}
                          <p className="sug-text">{s.text}</p>
                          {Array.isArray(s.keywords) && s.keywords.length > 0 && (
                            <div className="chips" style={{ marginBottom: 10 }}>{s.keywords.map((k, i) => <span className="chip ok" key={i}>{k}</span>)}</div>
                          )}
                          <div className="sug-actions">
                            {accepted ? (
                              <>
                                <span className="sug-applied"><Check size={14} /> Applied</span>
                                <button className="rb-btn rb-btn-ghost rb-btn-sm" onClick={() => undoSug(s)}><RotateCcw size={13} /> Undo</button>
                              </>
                            ) : rejected ? (
                              <button className="rb-btn rb-btn-ghost rb-btn-sm" onClick={() => acceptSug(s)}><RotateCcw size={13} /> Reconsider</button>
                            ) : (
                              <>
                                <button className="rb-btn rb-btn-acc rb-btn-sm" onClick={() => acceptSug(s)}><Check size={13} /> Accept</button>
                                <button className="rb-btn rb-btn-ghost rb-btn-sm" onClick={() => rejectSug(s)}><X size={13} /> Reject</button>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* COVER LETTER TAB */}
                {tab === "cover" && (
                  <div className="rb-panel">
                    <div className="rb-toolbar">
                      <div className="rb-lbl" style={{ margin: 0 }}>A short, factual letter built from your resume and this role.</div>
                      <div className="rb-dlrow">
                        {cover && (
                          <>
                            <button className="rb-btn rb-btn-ghost rb-btn-sm" onClick={copyCover}>{copiedCover ? <><Check size={13} /> Copied</> : <><FileText size={13} /> Copy</>}</button>
                            <button className="rb-btn rb-btn-ghost rb-btn-sm" onClick={downloadCover}><FileDown size={13} /> Download</button>
                          </>
                        )}
                        <button className="rb-btn rb-btn-acc rb-btn-sm" onClick={genCover} disabled={coverBusy}>
                          {coverBusy ? <><Loader2 size={13} className="spin" /> Writing…</> : <><Mail size={13} /> {cover ? "Regenerate" : "Generate cover letter"}</>}
                        </button>
                      </div>
                    </div>
                    {cover
                      ? <div className="proseout">{cover}</div>
                      : !coverBusy && <div className="rb-empty"><div className="big"><Mail size={24} /></div><h3>No cover letter yet</h3><p>Generate one tailored to this job — kept honest and under ~280 words.</p></div>}
                  </div>
                )}

                {/* INTERVIEW PREP TAB */}
                {tab === "prep" && (
                  <div className="rb-panel">
                    <div className="rb-toolbar">
                      <div className="rb-lbl" style={{ margin: 0 }}>Talking points grounded in your real experience.</div>
                      <button className="rb-btn rb-btn-acc rb-btn-sm" onClick={genPrep} disabled={prepBusy}>
                        {prepBusy ? <><Loader2 size={13} className="spin" /> Preparing…</> : <><MessageSquare size={13} /> {prep ? "Regenerate" : "Generate interview prep"}</>}
                      </button>
                    </div>
                    {prep ? (
                      <>
                        {Array.isArray(prep.strengths) && prep.strengths.length > 0 && (
                          <div className="rb-sec"><h4><Check size={15} /> Lead with these strengths</h4>
                            <ul className="rb-list">{prep.strengths.map((s,i) => <li key={i}><Check size={14} className="mk" style={{ color: "var(--green)" }} />{s}</li>)}</ul></div>
                        )}
                        {Array.isArray(prep.likelyQuestions) && prep.likelyQuestions.length > 0 && (
                          <div className="rb-sec"><h4><MessageSquare size={15} /> Likely questions</h4>
                            <ul className="rb-list">{prep.likelyQuestions.map((q,i) => <li key={i}><ChevronRight size={14} className="mk" /><span><b>{q.question}</b><br /><span style={{ color: "var(--muted)" }}>{q.angle}</span></span></li>)}</ul></div>
                        )}
                        {Array.isArray(prep.gapsToAddress) && prep.gapsToAddress.length > 0 && (
                          <div className="rb-sec"><h4><AlertTriangle size={15} /> Handling the gaps</h4>
                            <ul className="rb-list">{prep.gapsToAddress.map((g,i) => <li key={i}><AlertTriangle size={14} className="mk" style={{ color: "var(--amber)" }} /><span><b>{g.gap}</b> — {g.strategy}</span></li>)}</ul></div>
                        )}
                        {Array.isArray(prep.storiesToTell) && prep.storiesToTell.length > 0 && (
                          <div className="rb-sec"><h4><FileText size={15} /> STAR stories to prepare</h4>
                            <ul className="rb-list">{prep.storiesToTell.map((s,i) => <li key={i}><ChevronRight size={14} className="mk" />{s}</li>)}</ul></div>
                        )}
                      </>
                    ) : !prepBusy && <div className="rb-empty"><div className="big"><MessageSquare size={24} /></div><h3>No prep yet</h3><p>Generate likely questions, strengths to emphasize, and honest ways to handle gaps.</p></div>}
                  </div>
                )}

                {/* HISTORY TAB */}
                {tab === "history" && (
                  <div className="rb-panel">
                    {versions.length === 0
                      ? <div className="rb-empty"><div className="big"><History size={24} /></div><h3>No saved resumes yet</h3><p>Every resume you optimize is saved here automatically. Search by company later to reopen and download it anytime.</p></div>
                      : (<>
                          <input className="rb-in" style={{ marginBottom: 12 }} value={histQuery} onChange={(e) => setHistQuery(e.target.value)} placeholder="Search saved resumes by company or job title…  e.g. ABC Company" />
                          <div className="rb-lbl">{shownVersions.length} saved resume{shownVersions.length === 1 ? "" : "s"}{histQ ? " matching “" + histQuery.trim() + "”" : ""} · open one to view & download, or pick two to compare.</div>
                          {shownVersions.length === 0 && <div className="rb-hint">No saved resume matches that search. Try a different company name.</div>}
                          {shownVersions.map(v => (
                            <div className="histrow" key={v.id}>
                              <div className="info">
                                <div className="t">{v.company ? v.company : "—"}{v.jobTitle ? " · " + v.jobTitle : ""}</div>
                                <div className="s">{new Date(v.at).toLocaleString()} · {(TEMPLATES.find(t => t.id === v.tpl) || {}).name || v.tpl}</div>
                              </div>
                              <div className="sc"><span className="scpill">Match {v.match}%</span><span className="scpill">Keywords {v.coverage}%</span></div>
                              <div className="histacts">
                                <button className={"rb-btn rb-btn-sm " + (cmp.includes(v.id) ? "rb-btn-acc" : "rb-btn-ghost")} onClick={() => toggleCmp(v.id)}>{cmp.includes(v.id) ? "Selected" : "Compare"}</button>
                                <button className="rb-btn rb-btn-acc rb-btn-sm" onClick={() => restoreVersion(v)}><Download size={13} /> Open &amp; download</button>
                              </div>
                            </div>
                          ))}

                          {cmpVersions.length === 2 && (
                            <div className="rb-sec" style={{ marginTop: 16 }}>
                              <h4><Layers size={15} /> Comparison</h4>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                                {cmpVersions.map(v => (
                                  <div key={v.id}>
                                    <div style={{ fontWeight: 650, fontSize: 13 }}>{v.jobTitle}</div>
                                    <div className="sc" style={{ margin: "8px 0" }}><span className="scpill">Match {v.match}%</span><span className="scpill">Keywords {v.coverage}%</span></div>
                                    <div className="rb-lbl">Summary</div>
                                    <p style={{ fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.5, margin: "0 0 8px" }}>{v.tailored?.summary || "—"}</p>
                                    <div className="rb-lbl">{(v.tailored?.experience || []).reduce((n,e) => n + (e.bullets?.length || 0), 0)} experience bullets across {(v.tailored?.experience || []).length} roles</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>)}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================ */
/*  Authentication + admin approval layer (wraps the resume app) */
/* ============================================================ */
function Centered({ children }){
  return (
    <div className="rb-root" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{CSS}</style>
      <div style={{ width: "100%", maxWidth: 430 }}>{children}</div>
    </div>
  );
}

function AuthScreen(){
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const submit = async () => {
    if(!email.trim() || !pw){ setMsg("Enter your email and a password."); return; }
    setBusy(true); setMsg("");
    try {
      if(mode === "register"){
        const { error } = await supabase.auth.signUp({ email: email.trim(), password: pw });
        if(error) throw error;
        setMsg("Account created. An admin needs to approve you before you can use the app.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
        if(error) throw error;
      }
    } catch(e){ setMsg(e.message || "Something went wrong."); }
    finally { setBusy(false); }
  };
  return (
    <Centered>
      <div className="rb-card">
        <div className="rb-ch"><div className="ico"><Sparkles size={16} /></div><div><div className="eyebrow">Resume Tailor</div><h2 style={{ marginTop: 1 }}>{mode === "login" ? "Sign in" : "Create an account"}</h2></div></div>
        <div className="rb-cb">
          <div className="rb-lbl">Email</div>
          <input className="rb-in" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          <div className="rb-lbl" style={{ marginTop: 10 }}>Password</div>
          <input className="rb-in" type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="At least 6 characters" onKeyDown={e => e.key === "Enter" && submit()} />
          <button className="rb-btn rb-btn-pri rb-btn-block" style={{ marginTop: 14 }} onClick={submit} disabled={busy}>
            {busy ? <><Loader2 size={15} className="spin" /> Please wait…</> : (mode === "login" ? "Sign in" : "Register")}
          </button>
          {msg && <div className="rb-banner" style={{ marginTop: 12, marginBottom: 0 }}><AlertTriangle size={14} style={{ flex: "none", marginTop: 1 }} />{msg}</div>}
          <p className="rb-hint" style={{ textAlign: "center", marginTop: 12 }}>
            {mode === "login" ? "New here? " : "Already have an account? "}
            <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setMsg(""); }} style={{ background: "none", border: "none", color: "var(--green-ink)", cursor: "pointer", fontWeight: 600, fontFamily: "inherit", fontSize: "inherit" }}>{mode === "login" ? "Register" : "Sign in"}</button>
          </p>
        </div>
      </div>
    </Centered>
  );
}

function StatusScreen({ profile, onSignOut }){
  const rejected = profile.status === "rejected";
  return (
    <Centered>
      <div className="rb-card">
        <div className="rb-cb" style={{ textAlign: "center", padding: "32px 26px" }}>
          <div style={{ width: 54, height: 54, borderRadius: 15, background: rejected ? "var(--red-tint)" : "var(--amber-tint)", display: "grid", placeItems: "center", margin: "0 auto 14px", color: rejected ? "var(--red)" : "var(--amber)" }}>
            {rejected ? <X size={26} /> : <Loader2 size={26} />}
          </div>
          <h3 style={{ margin: "0 0 6px", fontSize: 17, color: "var(--ink)", fontWeight: 650 }}>{rejected ? "Access not granted" : "Awaiting approval"}</h3>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: 13.5, lineHeight: 1.55 }}>
            {rejected ? "An admin hasn't granted you access to this app. If you think this is a mistake, contact the administrator." : "Your account is registered and waiting for an admin to approve it. This page updates automatically once you're approved."}
          </p>
          <button className="rb-btn rb-btn-ghost rb-btn-sm" style={{ marginTop: 18 }} onClick={onSignOut}>Sign out</button>
        </div>
      </div>
    </Centered>
  );
}

function AdminPanel({ onClose, meId }){
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const load = async () => {
    setLoading(true); setErr("");
    const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
    if(error) setErr(error.message); else setUsers(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);
  const update = async (id, patch) => {
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if(error) setErr(error.message); else load();
  };
  const setLimit = (u) => {
    const cur = u.daily_token_limit == null ? "" : String(u.daily_token_limit);
    const v = window.prompt("Daily token limit for " + u.email + " (a number). Leave blank for UNLIMITED:", cur);
    if(v === null) return;
    update(u.id, { daily_token_limit: v.trim() === "" ? null : Math.max(0, parseInt(v, 10) || 0) });
  };
  const pending = users.filter(u => u.status === "pending");
  return (
    <div className="rb-card" style={{ marginTop: 14 }}>
      <div className="rb-ch">
        <div className="ico"><ShieldCheck size={16} /></div>
        <div><div className="eyebrow">Admin{pending.length ? " · " + pending.length + " pending" : ""}</div><h2 style={{ marginTop: 1 }}>User management</h2></div>
        <button className="rb-btn rb-btn-ghost rb-btn-sm" style={{ marginLeft: "auto" }} onClick={load}><RefreshCw size={13} /> Refresh</button>
        <button className="rb-btn rb-btn-ghost rb-btn-sm" onClick={onClose}>Close</button>
      </div>
      <div className="rb-cb">
        {err && <div className="rb-err"><AlertTriangle size={14} style={{ flex: "none", marginTop: 1 }} />{err}</div>}
        {loading ? <div className="rb-hint">Loading users…</div> : (
          users.length === 0 ? <div className="rb-hint">No users yet.</div> :
          users.map(u => (
            <div className="histrow" key={u.id}>
              <div className="info">
                <div className="t">{u.email || u.id.slice(0, 8)}{u.is_admin ? " · admin" : ""}{u.id === meId ? " (you)" : ""}</div>
                <div className="s">
                  status: <b style={{ color: u.status === "approved" ? "var(--green-ink)" : u.status === "rejected" ? "var(--red)" : "var(--amber)" }}>{u.status}</b>
                  {"  ·  limit: "}<b>{u.daily_token_limit == null ? "unlimited" : u.daily_token_limit.toLocaleString() + " / day"}</b>
                  {"  ·  used today: " + (u.tokens_used || 0).toLocaleString()}
                </div>
              </div>
              <div className="histacts" style={{ flexWrap: "wrap" }}>
                {u.status !== "approved" && <button className="rb-btn rb-btn-acc rb-btn-sm" onClick={() => update(u.id, { status: "approved" })}><Check size={13} /> Approve</button>}
                {u.status !== "rejected" && u.id !== meId && <button className="rb-btn rb-btn-ghost rb-btn-sm" onClick={() => update(u.id, { status: "rejected" })}><X size={13} /> Reject</button>}
                <button className="rb-btn rb-btn-ghost rb-btn-sm" onClick={() => setLimit(u)}>Set limit</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function App(){
  const [session, setSession] = useState(undefined); // undefined = still loading
  const [profile, setProfile] = useState(null);
  const [adminOpen, setAdminOpen] = useState(false);

  useEffect(() => {
    if(!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session || null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s || null));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if(!supabase || !session){ setProfile(null); return; }
    let active = true;
    const fetchProfile = async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
      if(active) setProfile(data || null);
    };
    fetchProfile();
    const iv = setInterval(fetchProfile, 20000); // pick up approval changes while waiting
    return () => { active = false; clearInterval(iv); };
  }, [session]);

  const signOut = async () => { await supabase.auth.signOut(); setProfile(null); setAdminOpen(false); };

  if(!supabase) return <ResumeApp />;                 // not configured yet → run open
  if(session === undefined) return <Centered><Loader2 size={28} className="spin" style={{ color: "var(--green)" }} /></Centered>;
  if(!session) return <AuthScreen />;
  if(profile === null) return <Centered><Loader2 size={28} className="spin" style={{ color: "var(--green)" }} /></Centered>;
  if(profile.status !== "approved") return <StatusScreen profile={profile} onSignOut={signOut} />;

  return (
    <div className="rb-root">
      <style>{CSS}</style>
      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "10px 20px 0", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 10, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>{profile.email}{profile.is_admin ? " · admin" : ""}{profile.daily_token_limit == null ? " · unlimited" : ""}</span>
        {profile.is_admin && <button className="rb-btn rb-btn-ghost rb-btn-sm" onClick={() => setAdminOpen(o => !o)}><ShieldCheck size={13} /> {adminOpen ? "Hide admin" : "Admin"}</button>}
        <button className="rb-btn rb-btn-ghost rb-btn-sm" onClick={signOut}>Sign out</button>
      </div>
      {adminOpen && profile.is_admin
        ? <div style={{ maxWidth: 1180, margin: "0 auto", padding: "0 20px" }}><AdminPanel onClose={() => setAdminOpen(false)} meId={session.user.id} /></div>
        : <ResumeApp />}
    </div>
  );
}
