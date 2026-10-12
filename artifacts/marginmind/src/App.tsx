import { useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Redirect, Link, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { ClerkProvider, Show, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import Papa from 'papaparse';
import {
  Activity, AlertCircle, AlertTriangle, ArrowRight, ArrowUpRight, BarChart3, Bell,
  Building2, Check, ChevronDown, CircleHelp, ClipboardList, Download, FileDown,
  FileSearch, FileSpreadsheet, Filter, Gauge, History, LayoutDashboard, Lightbulb, LoaderCircle,
  LockKeyhole, Menu, Package, Plus, Search, Settings, ShieldCheck, SlidersHorizontal, Sparkles,
  Upload, X,
} from 'lucide-react';
import {
  useCreateCompany, useCreateReport, useExportReport, useGetCurrentUser, useGetDashboard,
  useGetLatestAnalysis, useGetSettings, useImportTransactions, useListAnalysisHistory,
  useListCompanies, useListFindings, useListImports, useListProducts, useListReports,
  useListScenarios, useListTransactions, useRequestImportUploadUrl, useRunAnalysis,
  useSaveScenario, useUpdateCompany, useUpdateFinding, useUpdateSettings,
  getExportReportQueryKey, getGetCurrentUserQueryKey, getGetDashboardQueryKey, getGetLatestAnalysisQueryKey, getGetSettingsQueryKey,
  getListAnalysisHistoryQueryKey, getListCompaniesQueryKey, getListFindingsQueryKey,
  getListImportsQueryKey, getListProductsQueryKey, getListReportsQueryKey,
  getListScenariosQueryKey, getListTransactionsQueryKey,
} from '@workspace/api-client-react';
import type { Company, TransactionRowInput } from '@workspace/api-client-react';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 15000 } } });
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY');
function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}
const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
    socialButtonsPlacement: 'top' as const,
    socialButtonsVariant: 'blockButton' as const,
  },
  variables: {
    colorPrimary: '#0066ff',
    colorForeground: '#1a1a1a',
    colorMutedForeground: '#626b77',
    colorDanger: '#c43f37',
    colorBackground: '#ffffff',
    colorInput: '#ffffff',
    colorInputForeground: '#1a1a1a',
    colorNeutral: '#dfe3e8',
    fontFamily: 'Manrope, sans-serif',
    borderRadius: '0.65rem',
  },
  elements: {
    rootBox: { width: '100%', display: 'flex', justifyContent: 'center' },
    cardBox: 'bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: { color: '#1a1a1a', fontFamily: 'Manrope, sans-serif', fontWeight: 700 },
    headerSubtitle: { color: '#626b77' },
    socialButtonsBlockButtonText: { color: '#1a1a1a', fontWeight: 600 },
    formFieldLabel: { color: '#3f4752', fontWeight: 600 },
    footerActionLink: { color: '#0058df', fontWeight: 700 },
    footerActionText: { color: '#626b77' },
    dividerText: { color: '#626b77' },
    identityPreviewEditButton: { color: '#0058df' },
    formFieldSuccessText: { color: '#228553' },
    alertText: { color: '#a53731' },
    logoBox: { display: 'flex', alignItems: 'center', justifyContent: 'center' },
    logoImage: { maxHeight: '34px', width: 'auto' },
    socialButtonsBlockButton: { borderColor: '#dfe3e8', backgroundColor: '#ffffff', borderRadius: '8px' },
    formButtonPrimary: { backgroundColor: '#0066ff', color: '#ffffff', borderRadius: '8px' },
    formFieldInput: { color: '#1a1a1a', backgroundColor: '#ffffff', borderColor: '#dfe3e8', borderRadius: '8px' },
    footerAction: { color: '#626b77' },
    dividerLine: { backgroundColor: '#e5e7eb' },
    alert: { backgroundColor: '#fff7f6', borderColor: '#f2c7c4', color: '#a53731' },
    otpCodeFieldInput: { color: '#1a1a1a', backgroundColor: '#ffffff', borderColor: '#dfe3e8' },
    formFieldRow: { color: '#1a1a1a' },
    main: { color: '#1a1a1a' },
  },
};
const navGroups = [
  { title: 'Workspace', items: [
    ['Dashboard', '/dashboard', LayoutDashboard], ['Companies', '/companies', Building2], ['Imports', '/imports', Upload], ['Transactions', '/transactions', FileSpreadsheet],
  ] },
  { title: 'Financial truth', items: [
    ['Analysis', '/analysis', Activity], ['Profit & loss', '/profit-loss', BarChart3], ['Revenue & expenses', '/revenue-expenses', ArrowUpRight], ['Financial health', '/financial-health', Gauge], ['Period comparison', '/period-comparison', SlidersHorizontal], ['Transparency', '/transparency', ShieldCheck],
  ] },
  { title: 'Review & planning', items: [
    ['Anomalies', '/anomalies', AlertTriangle], ['Products', '/products', Package], ['Simulator', '/simulator', SlidersHorizontal], ['Cost breakdown', '/cost-breakdown', ClipboardList], ['Insights', '/insights', Lightbulb],
  ] },
  { title: 'Records', items: [
    ['Reports', '/reports', FileDown], ['History', '/history', History], ['Notifications', '/notifications', Bell], ['Settings', '/settings', Settings],
  ] },
];
const titles: Record<string, [string, string]> = {
  '/dashboard':['Workspace overview','A clear view of what the source records currently support.'],
  '/companies':['Companies','Manage the company workspace used to scope your financial data.'],
  '/imports':['Source imports','Bring in transaction records without losing their original context.'],
  '/transactions':['Transactions','Inspect the rows behind every reconstructed figure.'],
  '/analysis':['Run an analysis','Reconstruct results for a defined reporting period.'],
  '/profit-loss':['Profit & loss','Reconstructed from valid source rows in the selected period.'],
  '/revenue-expenses':['Revenue & expenses','Only detail directly supported by imported records appears here.'],
  '/financial-health':['Financial health','Metrics are shown only when their required inputs are available.'],
  '/period-comparison':['Period comparison','Compare persisted analyses without blending reporting periods.'],
  '/transparency':['Reported vs reconstructed','See the gap between company-reported figures and source-based reconstruction.'],
  '/anomalies':['Review findings','Signals help prioritize review. They are not proof of misconduct.'],
  '/products':['Product contribution','Retained net sales less attributed variable costs.'],
  '/simulator':['Scenario simulator','Save adjusted price, discount, and cost assumptions.'],
  '/cost-breakdown':['Variable-cost basis','Review the cost fields attached to product source rows.'],
  '/insights':['Evidence-backed insights','Each finding links back to its source rows and analysis.'],
  '/reports':['Reports','Create and export reports tied to persisted analyses.'],
  '/history':['Analysis history','A record of persisted reconstructions and their assumptions.'],
  '/notifications':['Notifications','Current findings from your imported evidence.'],
  '/settings':['Settings','Workspace preferences for reporting and notifications.'],
};

function Brand({ link = true }: { link?: boolean }) {
  const mark = <><span className="brand-mark">m</span><span>marginmind</span></>;
  return link ? <Link href="/" className="brand" data-testid="link-brand">{mark}</Link> : <div className="brand">{mark}</div>;
}
function Button({ children, onClick, primary = false, testId, type = 'button', disabled = false, className = '' }: any) {
  return <button type={type} disabled={disabled} onClick={onClick} data-testid={testId} className={`btn ${primary ? 'btn-primary' : ''} ${className}`}>{children}</button>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="field"><label>{label}</label>{children}</div>; }
function EmptyState({ icon: Icon = FileSearch, title, detail, action }: any) {
  return <div className="empty-state"><div><div className="empty-icon"><Icon size={17}/></div><h3>{title}</h3><p>{detail}</p>{action}</div></div>;
}
function LoadingState() { return <div className="grid grid-2">{[0,1].map(i=><div className="panel" key={i}><div className="skeleton" style={{width:'36%',marginBottom:22}}/><div className="skeleton" style={{width:'65%',height:25,marginBottom:12}}/><div className="skeleton" style={{width:'48%'}}/></div>)}</div>; }
function ErrorState({ retry }: { retry: () => void }) { return <div className="error-box" data-testid="status-load-error">We could not retrieve this workspace data. <button className="btn btn-sm" onClick={retry} data-testid="button-retry">Retry</button></div>; }
function Kpi({ label, value, note, tone }: any) {
  return <div className="metric-card" data-testid={`metric-${label.toLowerCase().replace(/[^a-z]+/g,'-')}`}><div className="metric-label">{label}</div><div className={`metric-value ${tone || ''}`}>{value}</div><div className="metric-note">{note}</div></div>;
}
function money(value: number | null | undefined, currency = 'USD') {
  if (value == null || !Number.isFinite(Number(value))) return '—';
  return new Intl.NumberFormat(undefined,{style:'currency',currency,maximumFractionDigits:2}).format(Number(value));
}
function dateLabel(value?: string | null) { if (!value) return '—'; const d = new Date(value); return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}); }

function Landing() {
  const { isLoaded, isSignedIn } = useUser();
  const destination = isLoaded && isSignedIn ? '/dashboard' : '/sign-up';
  return <main className="landing">
    <header className="landing-nav"><Brand/><nav style={{display:'flex',gap:10,alignItems:'center'}}><Link href={isSignedIn?'/dashboard':'/sign-in'} className="btn btn-quiet" data-testid="link-sign-in">{isSignedIn?'Open workspace':'Sign in'}</Link><Link href={destination} className="btn btn-primary" data-testid="link-get-started">{isSignedIn?'Go to workspace':'Create workspace'} <ArrowRight size={14}/></Link></nav></header>
    <section className="landing-hero"><div><div className="eyebrow">Evidence before assumption</div><h1>Know what your business actually earns.</h1><p>MarginMind rebuilds the financial picture from your transaction rows—period by period, with the method and limitations in plain sight.</p><div style={{display:'flex',gap:10,marginTop:25}}><Link href={destination} className="btn btn-primary" data-testid="link-start-analysis">Start with your records <ArrowRight size={15}/></Link><Link href={isSignedIn?'/dashboard':'/sign-in'} className="btn" data-testid="link-existing-account">{isSignedIn?'Open workspace':'I have an account'}</Link></div><div style={{fontSize:10,color:'#89919c',marginTop:20,display:'flex',gap:8,alignItems:'center'}}><LockKeyhole size={12}/> Source files stay private. Figures remain traceable.</div></div>
      <div className="hero-art" aria-label="Illustration of reconciled source records"><div className="art-sheet one"><div className="eyebrow">Reconstruction / period</div><div style={{font:'700 18px var(--app-font-serif)'}}>Source-backed view</div><div className="art-line blue"/><div className="art-line"/><div className="art-line" style={{width:'80%'}}/><div className="art-grid"><div className="art-cell"/><div className="art-cell"/></div></div><div className="art-sheet two"><div style={{display:'flex',justifyContent:'space-between',fontSize:10}}><strong>Source rows</strong><span className="tag green">Validated</span></div><div className="art-line" style={{marginTop:18}}/><div className="art-line" style={{width:'76%'}}/><div className="art-line blue" style={{width:'58%'}}/><div style={{borderTop:'1px solid #edf0f2',marginTop:17,paddingTop:12,fontSize:9,color:'#7a828d'}}>Period • assumptions • method</div></div></div>
    </section>
    <section className="landing-section"><div className="eyebrow">A financial truth engine</div><h2>Every number has a paper trail.</h2><p className="subtitle">From private CSV upload to reproducible analysis, MarginMind makes the distinction between what was reported and what the source rows reconstruct.</p><div className="grid grid-3" style={{marginTop:34}}><div><span className="tag blue">01 / Trace</span><h3 style={{marginTop:15,fontSize:15}}>Follow the figure back</h3><p className="subtitle">Source line references travel alongside findings and period results.</p></div><div><span className="tag blue">02 / Separate</span><h3 style={{marginTop:15,fontSize:15}}>Keep truths distinct</h3><p className="subtitle">Reported totals, reconstructed profit, and product contribution each keep their own meaning.</p></div><div><span className="tag blue">03 / Repeat</span><h3 style={{marginTop:15,fontSize:15}}>Reproduce the method</h3><p className="subtitle">See the dates, assumptions, included rows, exclusions, and limitations that shaped an analysis.</p></div></div></section>
    <section className="landing-section"><div className="grid grid-2" style={{alignItems:'center'}}><div><div className="eyebrow">No invented baseline</div><h2>Your workspace starts empty. On purpose.</h2><p className="subtitle">No demo ledger dressed up as your business. Import your own evidence to begin; incomplete amounts stay incomplete instead of being silently treated as zero.</p></div><div className="callout"><strong style={{color:'#1a1a1a'}}>A responsible signal is a starting point.</strong><br/>Anomaly flags surface records worth checking. They do not establish intent or prove misconduct.</div></div></section>
    <footer className="landing-foot">MarginMind · Financial truth, accountable to evidence</footer>
  </main>;
}

function AuthPage({ signup = false }: { signup?: boolean }) {
  return <div className="auth-stage">
    <div style={{position:'absolute',top:22,left:24}}><Brand/></div>
    {signup
      ? <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
      : <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />}
    <Link href="/" className="btn btn-quiet" style={{position:'absolute',bottom:20}} data-testid="link-auth-home">Back to MarginMind</Link>
  </div>;
}

function Shell() {
  const [path, setPath] = useLocation();
  const qc = useQueryClient();
  const { user: clerkUser } = useUser();
  const { signOut } = useClerk();
  const currentUser = useGetCurrentUser({query:{queryKey:getGetCurrentUserQueryKey(),enabled:!!clerkUser,retry:false}});
  const companyQuery = useListCompanies();
  const companies = companyQuery.data || [];
  const [companyId,setCompanyId] = useState('');
  const [mobileOpen,setMobileOpen] = useState(false);
  const [search,setSearch] = useState('');
  const [notice,setNotice] = useState('');
  useEffect(()=>{ if (!companyId && companies[0]) setCompanyId(companies[0].id); },[companies,companyId]);
  const company = companies.find(c=>c.id===companyId);
  const active = !!companyId;
  const dash = useGetDashboard({companyId},{query:{enabled:active,queryKey:getGetDashboardQueryKey({companyId}),retry:false}});
  const imports = useListImports({companyId},{query:{enabled:active,queryKey:getListImportsQueryKey({companyId}),retry:false}});
  const transactions = useListTransactions({companyId,search:search || undefined,page:1,pageSize:50},{query:{enabled:active,queryKey:getListTransactionsQueryKey({companyId,search:search || undefined,page:1,pageSize:50}),retry:false}});
  const latest = useGetLatestAnalysis({companyId},{query:{enabled:active,queryKey:getGetLatestAnalysisQueryKey({companyId}),retry:false}});
  const history = useListAnalysisHistory({companyId},{query:{enabled:active,queryKey:getListAnalysisHistoryQueryKey({companyId}),retry:false}});
  const findings = useListFindings({companyId},{query:{enabled:active,queryKey:getListFindingsQueryKey({companyId}),retry:false}});
  const products = useListProducts({companyId},{query:{enabled:active,queryKey:getListProductsQueryKey({companyId}),retry:false}});
  const scenarios = useListScenarios({companyId},{query:{enabled:active,queryKey:getListScenariosQueryKey({companyId}),retry:false}});
  const reports = useListReports({companyId},{query:{enabled:active,queryKey:getListReportsQueryKey({companyId}),retry:false}});
  const settings = useGetSettings({query:{queryKey:getGetSettingsQueryKey(),retry:false}});
  const updateCompany = useUpdateCompany();
  const createCompany = useCreateCompany();
  const uploadUrl = useRequestImportUploadUrl();
  const importMutation = useImportTransactions();
  const runAnalysis = useRunAnalysis();
  const updateFinding = useUpdateFinding();
  const saveScenario = useSaveScenario();
  const createReport = useCreateReport();
  const updateSettings = useUpdateSettings();
  const invalidateCompany = () => {
    [getGetDashboardQueryKey({companyId}),getListImportsQueryKey({companyId}),getListTransactionsQueryKey({companyId}),getGetLatestAnalysisQueryKey({companyId}),getListAnalysisHistoryQueryKey({companyId}),getListFindingsQueryKey({companyId}),getListProductsQueryKey({companyId}),getListScenariosQueryKey({companyId}),getListReportsQueryKey({companyId}),getGetSettingsQueryKey()].forEach(queryKey=>qc.invalidateQueries({queryKey}));
  };
  const nav = navGroups.flatMap(group=>group.items).find(([,href])=>href===path)?.[0] as string || (titles[path]?.[0] || 'Workspace');
  const titleInfo = titles[path] || ['Workspace','Financial records, traceable to their source.'];
  const anyLoading = active && [dash,imports,transactions,latest,history,findings,products,scenarios,reports].some(q=>q.isLoading);
  const anyError = active && ((path==='/dashboard'&&dash.isError)||(path==='/imports'&&imports.isError)||(path==='/transactions'&&transactions.isError)||(['/profit-loss','/analysis'].includes(path)&&latest.isError));
  const currency = company?.currency || 'USD';
  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen?'open':''}`}><Brand link={false}/><div className="nav-scroll">{navGroups.map(g=><div key={g.title}><div className="nav-label">{g.title}</div>{g.items.map(([label,href,Icon]:any)=><Link key={href} href={href} className={`nav-link ${path===href?'active':''}`} onClick={()=>setMobileOpen(false)} data-testid={`nav-${href.slice(1)}`}><Icon size={15} strokeWidth={1.8}/>{label}</Link>)}</div>)}</div><div className="side-bottom"><button className="workspace-select" onClick={()=>setPath('/companies')} data-testid="button-current-company"><span style={{width:27,height:27,borderRadius:7,display:'grid',placeItems:'center',background:'#edf4ff',color:'#0066ff',fontSize:11,fontWeight:700}}>{company?.name?.slice(0,1)||'+'}</span><span style={{flex:1,minWidth:0}}><strong style={{fontSize:11,display:'block',overflow:'hidden',textOverflow:'ellipsis'}}>{company?.name||'Select a company'}</strong><span style={{fontSize:9,color:'#858c96'}}>{company?.currency||'Company scope'}</span></span><ChevronDown size={13} color="#858c96"/></button></div></aside>
      <div className="content-area"><header className="topbar"><div style={{display:'flex',alignItems:'center'}}><button className="mobile-toggle" onClick={()=>setMobileOpen(!mobileOpen)} aria-label="Toggle navigation" data-testid="button-mobile-menu">{mobileOpen?<X size={18}/>:<Menu size={18}/>}</button><div className="crumb">MarginMind <span style={{padding:'0 8px',color:'#c3c8ce'}}>/</span><strong>{nav}</strong></div></div><div style={{display:'flex',gap:10,alignItems:'center'}}><Link href="/notifications" className="btn btn-quiet" aria-label="Notifications" data-testid="link-notifications"><Bell size={16}/></Link><span style={{width:28,height:28,borderRadius:'50%',background:'#eaf0f7',display:'grid',placeItems:'center',fontSize:10,fontWeight:700,color:'#586475'}} data-testid="text-user-initials">{(clerkUser?.firstName||currentUser.data?.name||clerkUser?.primaryEmailAddress?.emailAddress||'U').slice(0,1).toUpperCase()}</span><Button onClick={()=>signOut({redirectUrl:basePath||'/'})} className="btn-sm" testId="button-sign-out">Sign out</Button></div></header>
      <main className="page-wrap"><div className="page-heading"><div><p className="eyebrow">MarginMind / {company?.name || 'Workspace'}</p><h1>{titleInfo[0]}</h1><p className="subtitle">{titleInfo[1]}</p></div>{path==='/transactions'&&<div style={{display:'flex',gap:8}}><label style={{position:'relative'}}><Search size={14} style={{position:'absolute',left:10,top:10,color:'#9298a2'}}/><input className="input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search source rows" style={{paddingLeft:31,width:200}} data-testid="input-transaction-search"/></label></div>}</div>
        {notice&&<div className="callout" style={{marginBottom:16,display:'flex',justifyContent:'space-between'}} data-testid="status-success">{notice}<button onClick={()=>setNotice('')} aria-label="Dismiss message"><X size={14}/></button></div>}
        {anyError?<ErrorState retry={()=>qc.invalidateQueries()}/>:anyLoading?<LoadingState/>:<PageContent path={path} company={company} companies={companies} selectCompany={setCompanyId} setPath={setPath} search={search} dashboard={dash.data} imports={imports.data||[]} transactions={transactions.data?.items||[]} transactionTotal={transactions.data?.total||0} analysis={latest.data} history={history.data||[]} findings={findings.data||[]} products={products.data||[]} scenarios={scenarios.data||[]} reports={reports.data||[]} settings={settings.data} notice={setNotice} invalidate={invalidateCompany} mutations={{createCompany,updateCompany,uploadUrl,importMutation,runAnalysis,updateFinding,saveScenario,createReport,updateSettings}}/>
        }
      </main>
    </div>
  </div>;
}

function PageContent(props: any) {
  const {path,company,companies,selectCompany,setPath,search,dashboard,imports,transactions,transactionTotal,analysis,history,findings,products,scenarios,reports,settings,notice,invalidate,mutations}=props;
  const currency=company?.currency||'USD';
  const [form,setForm]=useState<any>({});
  const [file,setFile]=useState<File|null>(null);
  const [amountBasis,setAmountBasis]=useState('unknown');
  const [numberFormat,setNumberFormat]=useState('');
  const [dateFormat,setDateFormat]=useState('auto');
  const [assumeCompanyCurrency,setAssumeCompanyCurrency]=useState(false);
  const [importKey,setImportKey]=useState(()=>crypto.randomUUID());
  const [parsed,setParsed]=useState<{headers:string[],rows:string[][]}|null>(null);
  const [mapping,setMapping]=useState<Record<string,number>>({});
  const [preview,setPreview]=useState<TransactionRowInput[]>([]);
  const [busy,setBusy]=useState(false);
  const [editId,setEditId]=useState('');
  const [exportingId,setExportingId]=useState('');
  const exportQuery=useExportReport(exportingId,{query:{enabled:!!exportingId,queryKey:getExportReportQueryKey(exportingId)}});
  useEffect(()=>{if(exportQuery.data){const blob=new Blob([exportQuery.data.content],{type:exportQuery.data.contentType||'text/csv'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=exportQuery.data.fileName;a.click();URL.revokeObjectURL(url);setExportingId('');}},[exportQuery.data]);
  const safeMutation=(m:any,data:any,done?:()=>void)=>m.mutate({data},{onSuccess:()=>{invalidate();done?.();notice('Saved. Related company records have been refreshed.');},onError:(err:any)=>notice(err?.message||'The change could not be saved. Please try again.')});
  const analysisId=analysis?.id;
  const parseFile=async(f:File)=>{
    if(f.size>20*1024*1024){notice('CSV files must be 20 MB or smaller.');return;}
    setFile(f);setPreview([]);setNumberFormat('');setDateFormat('auto');setAmountBasis('unknown');setAssumeCompanyCurrency(false);setImportKey(crypto.randomUUID());
    const text=await f.text();
    const result=Papa.parse<string[]>(text,{skipEmptyLines:'greedy',dynamicTyping:false,delimiter:''});
    const parseError=result.errors[0];
    if(parseError){notice(`CSV parsing stopped at row ${parseError.row+1}: ${parseError.message}`);setParsed(null);return;}
    const records=result.data;
    if(records.length<1){setParsed({headers:[],rows:[]});return;}
    const headers=records[0].map(h=>String(h??'').trim());
    const rows=records.slice(1).filter(cells=>cells.some(cell=>String(cell??'').trim()!=='')).map(cells=>cells.map(cell=>String(cell??'')));
    setParsed({headers,rows});
    const find=(...terms:string[])=>headers.findIndex(h=>terms.some(t=>h.toLowerCase().replace(/[^a-z]/g,'').includes(t)));
    setMapping({date:find('date'),description:find('description','memo','details'),amount:find('amount','total'),type:find('type','transaction'),currency:find('currency','curr'),productName:find('product','item'),quantity:find('quantity','qty'),unitPrice:find('unitprice','price'),unitCost:find('unitcost','cost'),discountAmount:find('discount'),packagingCost:find('packaging'),deliveryCost:find('delivery'),paymentFee:find('paymentfee','processingfee'),returnedQuantity:find('returnedquantity','returnqty'),sourceId:find('id','reference')});
  };
  const makePreview=()=>{
    if(!parsed)return;
    if(!numberFormat){notice('Choose the source number format before validating amounts.');return;}
    if(!dateFormat&&parsed.rows.some(cells=>{const value=mapping.date>=0?cells[mapping.date]?.trim():'';return value&&!/^\d{4}-\d{2}-\d{2}$/.test(value);})){notice('Choose the source date format before validating dates.');return;}
    const rows:TransactionRowInput[]=parsed.rows.map((cells,i)=>{
      const get=(k:string)=>mapping[k]>=0?cells[mapping[k]]?.trim()||'': '';
      const issues:string[]=[];
      const numeric=(s:string,field:string)=>{if(s===''){if(field==='amount')issues.push('Amount is missing.');return null;}let value=s.trim().replace(/[$€£₹\s\u00a0]/g,'');const parenthesized=value.startsWith('(')&&value.endsWith(')');if(parenthesized)value=value.slice(1,-1);let normalized=value;const us=/^-?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/;const eu=/^-?(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d+)?$/;const plain=/^-?\d+(?:\.\d+)?$/;if(numberFormat==='us'&&us.test(value))normalized=value.replaceAll(',','');else if(numberFormat==='eu'&&eu.test(value))normalized=value.replaceAll('.','').replace(',','.');else if(numberFormat==='plain'&&plain.test(value))normalized=value;else{issues.push(`${field} does not match the selected number format.`);return null;}const parsedNumber=Number(normalized)*(parenthesized?-1:1);if(!Number.isFinite(parsedNumber)){issues.push(`${field} is not a valid number.`);return null;}return parsedNumber;};
      const dateValue=(s:string)=>{if(!s)return null;let y=0,m=0,d=0;let p:RegExpMatchArray|null=null;if(dateFormat==='auto'||dateFormat==='ymd'){p=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);if(p){y=Number(p[1]);m=Number(p[2]);d=Number(p[3]);}}else if(dateFormat==='mdy'){p=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(p){m=Number(p[1]);d=Number(p[2]);y=Number(p[3]);}}else if(dateFormat==='dmy'){p=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);if(p){d=Number(p[1]);m=Number(p[2]);y=Number(p[3]);}}else if(dateFormat==='dmyDash'){p=s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);if(p){d=Number(p[1]);m=Number(p[2]);y=Number(p[3]);}}else if(dateFormat==='monthName'){p=s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);if(p){d=Number(p[1]);m=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(p[2].toLowerCase())+1;y=Number(p[3]);}}if(!p)return null;const date=new Date(Date.UTC(y,m-1,d));if(date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d)return null;return `${String(y).padStart(4,'0')}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;};
      const typeRaw=get('type').toLowerCase();
      const type=['sale','refund','expense','discount','shipping','cogs','fee','tax','other'].includes(typeRaw)?typeRaw:'other';
      if(!typeRaw||!['sale','refund','expense','discount','shipping','cogs','fee','tax','other'].includes(typeRaw))issues.push('Transaction type is missing or unrecognized.');
      const amount=mapping.amount>=0?numeric(get('amount'),'amount'):(issues.push('No amount column is mapped.'),null);
      const date=dateValue(get('date'));
      if(!date)issues.push('Date is missing or does not match the selected date format.');
      if(!get('currency')&&!assumeCompanyCurrency&&mapping.currency<0)issues.push('Currency is missing; map a currency column or explicitly use the company currency.');
      const raw=Object.fromEntries(parsed.headers.map((h,j)=>[h,cells[j]??'']));
      return {sourceLine:i+2,sourceId:get('sourceId')||null,date:date as any,description:get('description')||null,type:type as any,amount,amountBasis:(type==='sale'?amountBasis:'not_applicable') as any,currency:get('currency')||((mapping.currency<0&&assumeCompanyCurrency)?company?.currency:null),productName:get('productName')||null,quantity:numeric(get('quantity'),'quantity'),unitPrice:numeric(get('unitPrice'),'unit price'),unitCost:numeric(get('unitCost'),'unit cost'),discountAmount:numeric(get('discountAmount'),'discount amount'),packagingCost:numeric(get('packagingCost'),'packaging cost'),deliveryCost:numeric(get('deliveryCost'),'delivery cost'),paymentFee:numeric(get('paymentFee'),'payment fee'),returnedQuantity:numeric(get('returnedQuantity'),'returned quantity'),raw:{...raw,_clientValidation:{status:issues.length?'review':'pending',issues}}};
    });
    setPreview(rows);
  };
  const doImport=async()=>{
    if(!file||!company||!preview.length)return;
    setBusy(true);
    try {
      const res=await mutations.uploadUrl.mutateAsync({data:{name:file.name,size:file.size,contentType:file.type||'text/csv'}});
      const response=await fetch(res.uploadURL,{method:'PUT',headers:{'Content-Type':file.type||'text/csv'},body:file});
      if(!response.ok)throw new Error('Private source upload failed. No import was submitted.');
      await mutations.importMutation.mutateAsync({data:{companyId:company.id,fileName:file.name,sourceObjectPath:res.objectPath,idempotencyKey:importKey,rows:preview}});
      invalidate();notice('Import submitted. Source rows and validation counts are now available.');setPreview([]);setParsed(null);setFile(null);setImportKey(crypto.randomUUID());
    }catch(e:any){notice(e.message||'Import could not be completed.');}finally{setBusy(false);}
  };
  if(!company && path!=='/companies'&&path!=='/settings') return <div className="panel"><EmptyState icon={Building2} title="Create a company workspace first" detail="Company-scoped figures, source records, and analysis are intentionally unavailable until a company is selected." action={<Button primary onClick={()=>setPath('/companies')} testId="button-create-first-company"><Plus size={14}/> Create company</Button>}/></div>;

  if(path==='/companies') return <div className="grid grid-2">
    <section className="panel"><div className="panel-title"><div><h2>{editId?'Edit company':'Company workspaces'}</h2><p>Every analysis is scoped to one company.</p></div>{editId&&<Button onClick={()=>{setEditId('');setForm({})}} testId="button-cancel-company-edit">Cancel</Button>}</div>
      <form onSubmit={e=>{e.preventDefault();const input={name:form.name||'',description:form.description||null,industry:form.industry||null,country:form.country||null,currency:(form.currency||'USD').toUpperCase(),fiscalYearEnd:form.fiscalYearEnd||null};if(editId){mutations.updateCompany.mutate({companyId:editId,data:input},{onSuccess:()=>{queryClient.invalidateQueries({queryKey:getListCompaniesQueryKey()});selectCompany(editId);setEditId('');setForm({});notice('Company details updated.');},onError:(x:any)=>notice(x.message||'Could not update company.')});}else mutations.createCompany.mutate({data:input},{onSuccess:(created:Company)=>{queryClient.invalidateQueries({queryKey:getListCompaniesQueryKey()});selectCompany(created.id);setForm({});notice('Company workspace created.');},onError:(x:any)=>notice(x.message||'Could not create company.')});}} data-testid="form-company">
        <Field label="Company name"><input className="input" required maxLength={160} value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})} data-testid="input-company-name"/></Field>
        <Field label="Description"><input className="input" value={form.description||''} onChange={e=>setForm({...form,description:e.target.value})} data-testid="input-company-description"/></Field>
        <div className="grid grid-2"><Field label="Industry"><input className="input" value={form.industry||''} onChange={e=>setForm({...form,industry:e.target.value})} data-testid="input-company-industry"/></Field><Field label="Country"><input className="input" value={form.country||''} onChange={e=>setForm({...form,country:e.target.value})} data-testid="input-company-country"/></Field></div>
        <div className="grid grid-2"><Field label="Currency"><input className="input" required minLength={3} maxLength={3} value={form.currency||'USD'} onChange={e=>setForm({...form,currency:e.target.value.toUpperCase()})} data-testid="input-company-currency"/></Field><Field label="Fiscal year end (MM-DD)"><input className="input" placeholder="12-31" pattern="(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])" value={form.fiscalYearEnd||''} onChange={e=>setForm({...form,fiscalYearEnd:e.target.value})} data-testid="input-fiscal-year-end"/></Field></div>
        <Button primary type="submit" testId="button-save-company"><Check size={14}/>{editId?'Save company':'Create company'}</Button>
      </form>
    </section>
    <section className="panel"><div className="panel-title"><div><h2>Your companies</h2><p>No demo records are included.</p></div><span className="tag">{companies.length} total</span></div>{companies.length===0?<EmptyState icon={Building2} title="No company workspaces yet" detail="Create a company to begin importing and analyzing its records."/>:<div style={{display:'grid',gap:9}}>{companies.map((c:Company)=><div key={c.id} style={{display:'flex',alignItems:'center',justifyContent:'space-between',border:'1px solid #edf0f3',borderRadius:8,padding:13}} data-testid={`company-row-${c.id}`}><button onClick={()=>{selectCompany(c.id);notice(`Workspace switched to ${c.name}.`);}} style={{border:0,background:'transparent',textAlign:'left',display:'flex',gap:11,alignItems:'center'}} data-testid={`button-select-company-${c.id}`}><span className="empty-icon" style={{margin:0,width:30,height:30}}><Building2 size={14}/></span><span><strong style={{display:'block',fontSize:12}}>{c.name}</strong><small style={{color:'#838b96'}}>{c.industry||'Industry not specified'} · {c.currency}</small></span></button><Button className="btn-sm" onClick={()=>{setEditId(c.id);setForm({...c});}} testId={`button-edit-company-${c.id}`}>Edit</Button></div>)}</div>}</section>
  </div>;

  if(path==='/dashboard'){
    const a=dashboard?.latestAnalysis;
    return <><div className="grid grid-4"><Kpi label="Reconstructed revenue" value={a?money(a.reconstructedRevenue,a.currency):'—'} note={a?`Period ${dateLabel(a.periodStart)} — ${dateLabel(a.periodEnd)}`:'Awaiting a persisted analysis'}/><Kpi label="Reconstructed profit" value={a?money(a.reconstructedProfit,a.currency):'—'} note={a?'Source-based result · not reported profit':'No analysis available yet'}/><Kpi label="Source rows" value={dashboard?.transactionCount??'—'} note={`${dashboard?.validTransactionCount??0} valid · ${dashboard?.invalidTransactionCount??0} require review`}/><Kpi label="Open findings" value={dashboard?.openFindingCount??'—'} note="Review signals, not conclusions"/></div>
      <div className="grid grid-2" style={{marginTop:17}}><section className="panel"><div className="panel-title"><div><h2>Financial position</h2><p>Latest saved reconstruction for {company?.name}</p></div><Link href="/analysis" className="btn btn-sm" data-testid="link-run-analysis">Run analysis <ArrowRight size={12}/></Link></div>{a?<div><div className="grid grid-3"><div><small className="metric-label">Revenue / reconstructed</small><div className="mono" style={{fontSize:17,marginTop:9}}>{money(a.reconstructedRevenue,a.currency)}</div></div><div><small className="metric-label">Expenses / reconstructed</small><div className="mono" style={{fontSize:17,marginTop:9}}>{money(a.reconstructedExpenses,a.currency)}</div></div><div><small className="metric-label">Profit / reconstructed</small><div className="mono" style={{fontSize:17,marginTop:9}}>{money(a.reconstructedProfit,a.currency)}</div></div></div><div className="callout" style={{marginTop:22}}>Includes {a.includedTransactionCount} source rows. Excludes {a.excludedTransactionCount}. Review methodology and limitations before relying on a decision.</div></div>:<EmptyState icon={Activity} title="No analysis to show" detail="Import source rows, then run an analysis to see an evidence-backed financial position." action={<Link href="/imports" className="btn btn-primary btn-sm" data-testid="link-first-import"><Upload size={13}/> Import source data</Link>}/>}</section>
      <section className="panel"><div className="panel-title"><div><h2>Workspace activity</h2><p>Persisted source and analysis records</p></div></div><div style={{display:'grid',gap:14}}><div style={{display:'flex',justifyContent:'space-between',fontSize:12}}><span>Source imports</span><strong>{dashboard?.importCount??0}</strong></div><div style={{display:'flex',justifyContent:'space-between',fontSize:12}}><span>Products found in rows</span><strong>{dashboard?.productCount??0}</strong></div><div style={{display:'flex',justifyContent:'space-between',fontSize:12}}><span>Latest analysis</span><strong>{a?dateLabel(a.createdAt):'Not run'}</strong></div><div style={{borderTop:'1px solid #edf0f3',paddingTop:14,display:'flex',gap:8}}><Link className="btn btn-sm" href="/transactions" data-testid="link-inspect-transactions">Inspect source rows</Link><Link className="btn btn-sm" href="/history" data-testid="link-analysis-history">Analysis history</Link></div></div></section></div>
      <section className="panel" style={{marginTop:17}}><div className="panel-title"><div><h2>Trust, built into the workflow</h2><p>Each view labels the kind of figure it contains.</p></div><ShieldCheck size={17} color="#0066ff"/></div><div className="grid grid-3"><div><span className="tag blue">Reported</span><p className="subtitle">Numbers supplied by your company, kept distinct from reconstructed values.</p></div><div><span className="tag green">Reconstructed</span><p className="subtitle">Totals reproducible from valid transaction rows for a specific period.</p></div><div><span className="tag amber">Contribution</span><p className="subtitle">Product retained sales after the variable costs actually attached to its rows.</p></div></div></section>
    </>;
  }

  if(path==='/imports') return <div className="grid grid-2">
    <section className="panel"><div className="panel-title"><div><h2>Upload source file</h2><p>CSV only · private source storage · max 20 MB</p></div><LockKeyhole size={16} color="#0066ff"/></div>
      <label className="empty-state" style={{display:'flex',cursor:'pointer',minHeight:125}} data-testid="upload-dropzone"><div><div className="empty-icon"><Upload size={17}/></div><h3>{file?file.name:'Choose a CSV to inspect'}</h3><p>Original file is uploaded privately. Rows are parsed in your browser before import.</p><input type="file" accept=".csv,text/csv" hidden onChange={e=>e.target.files?.[0]&&parseFile(e.target.files[0])} data-testid="input-csv-file"/></div></label>
      {parsed&&<div style={{marginTop:18}}><div className="panel-title"><div><h2>Map source columns</h2><p>Choose the source conventions explicitly; unmapped values remain in the raw row.</p></div><span className="tag">{parsed.rows.length} rows</span></div><div className="grid grid-2">{['date','description','amount','type','currency','productName','quantity','unitPrice','unitCost','discountAmount','packagingCost','deliveryCost','paymentFee','returnedQuantity','sourceId'].map(k=><Field key={k} label={k.replace(/[A-Z]/g,x=>' '+x.toLowerCase())}><select className="select" value={mapping[k]??-1} onChange={e=>setMapping({...mapping,[k]:Number(e.target.value)})} data-testid={`select-map-${k}`}><option value={-1}>Not mapped</option>{parsed.headers.map((h,i)=><option key={`${i}-${h}`} value={i}>{h}</option>)}</select></Field>)}
        <Field label="Sale amount basis"><select className="select" value={amountBasis} onChange={e=>setAmountBasis(e.target.value)} data-testid="select-amount-basis"><option value="unknown">Select basis</option><option value="gross">Gross before discounts</option><option value="net">Already net of discounts</option></select></Field>
        <Field label="Number format"><select className="select" value={numberFormat} onChange={e=>setNumberFormat(e.target.value)} data-testid="select-number-format"><option value="">Choose source format</option><option value="us">1,234.56 — comma grouping, period decimals</option><option value="eu">1.234,56 — period grouping, comma decimals</option><option value="plain">1234.56 — no grouping, period decimals</option></select></Field>
        <Field label="Date format"><select className="select" value={dateFormat} onChange={e=>setDateFormat(e.target.value)} data-testid="select-date-format"><option value="auto">YYYY-MM-DD only</option><option value="mdy">MM/DD/YYYY</option><option value="dmy">DD/MM/YYYY</option><option value="dmyDash">DD-MM-YYYY</option><option value="monthName">DD-MMM-YYYY</option></select></Field>
        {mapping.currency<0&&<label style={{display:'flex',alignItems:'center',gap:8,fontSize:11,color:'#555d67',marginBottom:14}}><input type="checkbox" checked={assumeCompanyCurrency} onChange={e=>setAssumeCompanyCurrency(e.target.checked)} data-testid="input-assume-company-currency"/> Treat rows without a currency column as {currency}</label>}
      </div><Button onClick={makePreview} testId="button-preview-import"><FileSearch size={14}/> Validate preview</Button></div>}
      {!!preview.length&&<div style={{marginTop:18}}><div className="callout" style={{marginBottom:13}}>{preview.filter(r=>r.amount===null).length} rows have no valid amount. They remain missing, not zero. {preview.filter(r=>(r.raw as any)?._clientValidation?.issues?.length).length} rows need review; invalid rows are retained with their original fields. {preview.length} rows will be submitted.</div><div className="table-wrap" style={{marginBottom:14,maxHeight:240}}><table><thead><tr><th>Source line</th><th>Date</th><th>Description</th><th>Type</th><th>Amount</th><th>Validation</th></tr></thead><tbody>{preview.slice(0,20).map(r=>{const issues=(r.raw as any)?._clientValidation?.issues||[];return <tr key={r.sourceLine}><td className="mono">{r.sourceLine}</td><td>{r.date||'—'}</td><td>{r.description||'—'}</td><td>{r.type}</td><td className="mono">{r.amount===null?'Missing':money(r.amount,currency)}</td><td><span className={`tag ${issues.length?'amber':'green'}`}>{issues.length?'Review':'Preview valid'}</span>{issues.length>0&&<div style={{fontSize:9,color:'#996711',whiteSpace:'normal',maxWidth:250,marginTop:4}}>{issues.join('; ')}</div>}</td></tr>})}</tbody></table></div><Button primary onClick={doImport} disabled={busy} testId="button-confirm-import">{busy?<LoaderCircle size={14}/>:<Upload size={14}/>} {busy?'Uploading source…':'Upload privately & import'}</Button></div>}
    </section>
    <section className="panel"><div className="panel-title"><div><h2>Import history</h2><p>Each import retains its source path and row-validation counts.</p></div><span className="tag">{imports.length} records</span></div>{imports.length===0?<EmptyState icon={FileSpreadsheet} title="No imports yet" detail="Your source files will appear here once submitted. No sample data is included."/>:<div className="table-wrap"><table><thead><tr><th>File</th><th>Status</th><th>Rows</th><th>Validation</th><th>Imported</th></tr></thead><tbody>{imports.map((i:any)=><tr key={i.id} data-testid={`row-import-${i.id}`}><td><strong>{i.fileName}</strong></td><td><span className={`tag ${i.status==='completed'?'green':i.status==='failed'?'red':'amber'}`}>{i.status}</span></td><td className="mono">{i.rowCount}</td><td>{i.validRowCount} valid · {i.invalidRowCount} invalid{ i.duplicateCandidateCount?` · ${i.duplicateCandidateCount} possible duplicates`:''}</td><td>{dateLabel(i.createdAt)}</td></tr>)}</tbody></table></div>}</section>
  </div>;

  if(path==='/transactions') return <section className="panel"><div className="panel-title"><div><h2>Source row register</h2><p>{transactionTotal} matching rows · values are shown as ingested</p></div><span className="tag"><Filter size={11}/> {transactions.length} visible</span></div>{transactions.length===0?<EmptyState icon={FileSearch} title={search?'No matching source rows':'No source rows yet'} detail={search?'Try a different search term.':'Import a CSV to inspect row-level evidence, validation, and duplicate candidates.'} action={!search&&<Link href="/imports" className="btn btn-primary btn-sm" data-testid="link-import-transactions"><Upload size={13}/> Import records</Link>}/>:<div className="table-wrap"><table><thead><tr><th>Source line</th><th>Date</th><th>Description</th><th>Type</th><th>Amount</th><th>Product</th><th>Row state</th><th>Raw source</th></tr></thead><tbody>{transactions.map((r:any)=><tr key={r.id} data-testid={`row-transaction-${r.id}`}><td className="mono">#{r.sourceLine}</td><td>{dateLabel(r.date)}</td><td><strong>{r.description||'—'}</strong><div style={{fontSize:9,color:'#8c939e'}}>Import {r.importId.slice(0,8)}{r.sourceId?` · Ref ${r.sourceId}`:''}</div></td><td>{r.type}</td><td className="mono">{r.amount===null?'Missing':money(r.amount,r.currency||currency)}</td><td>{r.productName||'—'}</td><td><span className={`tag ${!r.isValid?'red':r.duplicateCandidate?'amber':'green'}`}>{!r.isValid?'Needs review':r.duplicateCandidate?'Possible duplicate':'Valid'}</span>{r.validationIssues?.length>0&&<div style={{fontSize:9,color:'#a3443d',marginTop:4}}>{r.validationIssues.join('; ')}</div>}</td><td><details data-testid={`details-raw-source-${r.id}`}><summary style={{cursor:'pointer',color:'#0066ff',fontSize:10}}>Inspect row</summary><pre style={{whiteSpace:'pre-wrap',maxWidth:310,fontSize:9,color:'#555d67'}}>{JSON.stringify(r.raw,null,2)}</pre></details></td></tr>)}</tbody></table></div>}</section>;

  if(path==='/analysis') return <div className="grid grid-2"><section className="panel"><div className="panel-title"><div><h2>Define the reporting basis</h2><p>Reported figures are optional and remain clearly labeled as reported.</p></div><Activity size={16} color="#0066ff"/></div><form onSubmit={e=>{e.preventDefault();if(!company)return;const body:any={companyId:company.id,currency:company.currency,periodStart:form.periodStart||null,periodEnd:form.periodEnd||null};for(const k of ['reportedRevenue','reportedExpenses','reportedProfit'])if(form[k]!==''&&form[k]!=null)body[k]=Number(form[k]);mutations.runAnalysis.mutate({data:body},{onSuccess:()=>{invalidate();notice('Analysis persisted. Figures and limitations are available in the results views.');setPath('/profit-loss');},onError:(x:any)=>notice(x.message||'Analysis could not be run. Confirm source rows and period.')});}} data-testid="form-run-analysis">
      <div className="grid grid-2"><Field label="Period start"><input className="input" type="date" value={form.periodStart||''} onChange={e=>setForm({...form,periodStart:e.target.value})} data-testid="input-period-start"/></Field><Field label="Period end"><input className="input" type="date" value={form.periodEnd||''} onChange={e=>setForm({...form,periodEnd:e.target.value})} data-testid="input-period-end"/></Field></div>
      <div className="callout" style={{marginBottom:15}}>Optional figures below are values reported by your company. Leave blank when unavailable; do not substitute a reconstructed total.</div>
      {['reportedRevenue','reportedExpenses','reportedProfit'].map((k)=><Field key={k} label={`Reported ${k.replace('reported','').toLowerCase()}`}><input className="input" type="number" step="any" value={form[k]??''} onChange={e=>setForm({...form,[k]:e.target.value})} data-testid={`input-${k}`}/></Field>)}
      {mutations.runAnalysis.isError&&<p className="error-box">Analysis request failed. Check whether the period and source rows are valid.</p>}
      <Button primary type="submit" disabled={mutations.runAnalysis.isPending} testId="button-run-analysis">{mutations.runAnalysis.isPending?<LoaderCircle size={14}/>:<Activity size={14}/>} Reconstruct this period</Button>
    </form></section><section className="panel"><div className="panel-title"><div><h2>Latest persisted analysis</h2><p>Reproducible figures with source-row counts</p></div></div>{analysis?<AnalysisSummary analysis={analysis}/>:<EmptyState icon={Activity} title="No analysis has been run" detail="Analysis requires imported source records. Nothing is estimated in their absence." action={<Link href="/imports" className="btn btn-sm btn-primary" data-testid="link-analysis-import">Go to imports</Link>}/>}</section></div>;

  if(['/profit-loss','/revenue-expenses','/financial-health','/transparency'].includes(path)) {
    if(!analysis)return <section className="panel"><EmptyState icon={BarChart3} title="No persisted analysis for this company" detail="These views are based on persisted analyses. Run one after importing your source rows; no placeholder figures are shown." action={<Link href="/analysis" className="btn btn-primary btn-sm" data-testid="link-view-run-analysis">Run analysis</Link>}/></section>;
    if(path==='/profit-loss')return <section className="panel"><div className="panel-title"><div><h2>Reconstructed statement</h2><p>Period {dateLabel(analysis.periodStart)} — {dateLabel(analysis.periodEnd)} · reconstructed from transaction evidence</p></div><span className="tag blue">RECONSTRUCTED</span></div><StatementRow label="Revenue" value={money(analysis.reconstructedRevenue,analysis.currency)} indent={false}/><StatementRow label="Expenses" value={money(analysis.reconstructedExpenses,analysis.currency)} indent={false}/><StatementRow label="Reconstructed profit" value={money(analysis.reconstructedProfit,analysis.currency)} strong/><div className="grid grid-2" style={{marginTop:20}}><div className="callout">Included source rows <strong>{analysis.includedTransactionCount}</strong></div><div className="callout">Excluded source rows <strong>{analysis.excludedTransactionCount}</strong></div></div><div style={{marginTop:20}}><div className="panel-title"><div><h2>Methodology</h2><p>How this result was constructed</p></div></div><p style={{fontSize:12,lineHeight:1.7,color:'#555d67'}}>{analysis.methodology}</p><h3 style={{fontSize:12}}>Limitations</h3>{analysis.limitations?.length?analysis.limitations.map((x:string,i:number)=><p key={i} style={{fontSize:11,color:'#69717b'}}>• {x}</p>):<p style={{fontSize:11,color:'#69717b'}}>No limitations were returned with this analysis.</p>}</div></section>;
    if(path==='/transparency')return <section className="panel"><div className="panel-title"><div><h2>Numbers, without conflation</h2><p>Reported values are supplied figures; reconstructed values derive from source rows.</p></div><ShieldCheck size={16} color="#0066ff"/></div><div className="table-wrap"><table><thead><tr><th>Measure</th><th>Reported by company</th><th>Reconstructed from rows</th><th>Difference</th></tr></thead><tbody>{[['Revenue',analysis.reportedRevenue,analysis.reconstructedRevenue],['Expenses',analysis.reportedExpenses,analysis.reconstructedExpenses],['Profit',analysis.reportedProfit,analysis.reconstructedProfit]].map(([label,reported,reconstructed]:any)=><tr key={label}><td><strong>{label}</strong></td><td className="mono">{reported==null?'Not provided':money(reported,analysis.currency)}</td><td className="mono">{money(reconstructed,analysis.currency)}</td><td className="mono">{reported==null?'—':money(Number(reconstructed)-Number(reported),analysis.currency)}</td></tr>)}</tbody></table></div>{analysis.profitDifference!=null&&<div className="callout" style={{marginTop:14}}>Profit difference: <strong>{money(analysis.profitDifference,analysis.currency)}</strong>{analysis.profitDifferencePercent!=null&&` (${analysis.profitDifferencePercent}%)`}. A difference is a reconciliation point, not evidence of misconduct.</div>}<AnalysisSummary analysis={analysis}/></section>;
    if(path==='/financial-health')return <><div className="grid grid-3"><Kpi label="Reconstructed profit" value={money(analysis.reconstructedProfit,analysis.currency)} note="Available from the persisted period analysis"/><Kpi label="Profit margin" value={analysis.reconstructedRevenue?`${(analysis.reconstructedProfit/analysis.reconstructedRevenue*100).toFixed(1)}%`:'Unavailable'} note={analysis.reconstructedRevenue?'Profit divided by reconstructed revenue':'Revenue basis is zero or unavailable; no margin reported'}/><Kpi label="Evidence coverage" value={analysis.includedTransactionCount+analysis.excludedTransactionCount?`${(analysis.includedTransactionCount/(analysis.includedTransactionCount+analysis.excludedTransactionCount)*100).toFixed(1)}%`:'Unavailable'} note={`${analysis.includedTransactionCount} included · ${analysis.excludedTransactionCount} excluded`}/></div><div className="panel" style={{marginTop:17}}><div className="panel-title"><div><h2>Input availability</h2><p>Health indicators use only supplied or reconstructed inputs.</p></div></div><div className="callout">Cash runway, burn rate, and liquidity are not inferred because this workspace does not currently include cash balance or balance-sheet inputs.</div><AnalysisSummary analysis={analysis}/></div></>;
    return <RevenueExpenseDetail txns={transactions} currency={currency} setPath={setPath}/>;
  }

  if(path==='/period-comparison'||path==='/history') return <section className="panel"><div className="panel-title"><div><h2>{path==='/history'?'Persisted analyses':'Compare persisted periods'}</h2><p>Each analysis is a separate record with its own dates and assumptions.</p></div>{path==='/period-comparison'&&<Link href="/analysis" className="btn btn-sm" data-testid="link-comparison-run">Run another analysis <ArrowRight size={12}/></Link>}</div>{history.length===0?<EmptyState icon={History} title="No saved analyses" detail="Run an analysis to create a persisted period record for this company." action={<Link className="btn btn-primary btn-sm" href="/analysis" data-testid="link-empty-analysis-history">Run analysis</Link>}/>:<div className="table-wrap"><table><thead><tr><th>Period</th><th>Created</th><th>Revenue / reconstructed</th><th>Expenses / reconstructed</th><th>Profit / reconstructed</th><th>Rows</th></tr></thead><tbody>{history.map((a:any)=><tr key={a.id} data-testid={`analysis-record-${a.id}`}><td><strong>{dateLabel(a.periodStart)} — {dateLabel(a.periodEnd)}</strong></td><td>{dateLabel(a.createdAt)}</td><td className="mono">{money(a.reconstructedRevenue,a.currency)}</td><td className="mono">{money(a.reconstructedExpenses,a.currency)}</td><td className="mono"><strong>{money(a.reconstructedProfit,a.currency)}</strong></td><td>{a.includedTransactionCount} included / {a.excludedTransactionCount} excluded</td></tr>)}</tbody></table></div>}</section>;

  if(path==='/anomalies'||path==='/insights'||path==='/notifications') {
    const filtered=path==='/anomalies'?findings:path==='/insights'?findings.filter((f:any)=>f.status!=='dismissed'):findings.filter((f:any)=>f.status==='open');
    return <section className="panel"><div className="panel-title"><div><h2>{path==='/notifications'?'Current open findings':'Evidence-linked findings'}</h2><p>Anomaly signals are review prompts—not proof of misconduct.</p></div><span className="tag">{filtered.length} {path==='/notifications'?'open':'findings'}</span></div>{filtered.length===0?<EmptyState icon={path==='/notifications'?Bell:ShieldCheck} title={path==='/notifications'?'No open findings':'No findings to review'} detail={findings.length?'There are no findings in this view.':'Findings appear only when a persisted analysis returns evidence-backed review signals.'}/>:<div style={{display:'grid',gap:11}}>{filtered.map((f:any)=><FindingCard key={f.id} finding={f} update={(status:string,note:string)=>mutations.updateFinding.mutate({findingId:f.id,data:{status,reviewNote:note||null}},{onSuccess:()=>{qcInvalidateFindings(company?.id);notice('Finding status saved.');},onError:()=>notice('Could not update this finding.')})}/>)}</div>}</section>;
  }
  if(path==='/products'||path==='/cost-breakdown')return <section className="panel"><div className="panel-title"><div><h2>{path==='/products'?'Product contribution summary':'Cost fields present in source evidence'}</h2><p>{path==='/products'?'Contribution = retained net sales − attributed variable costs.':'Blank cost inputs remain unavailable; they are not treated as zero.'}</p></div><span className="tag">{products.length} products</span></div>{products.length===0?<EmptyState icon={Package} title="No product contribution data" detail="Product detail appears only when imported rows include product identity and support contribution calculations." action={<Link href="/imports" className="btn btn-sm btn-primary" data-testid="link-product-import">Import product rows</Link>}/>:<div className="table-wrap"><table><thead><tr>{path==='/products'?<><th>Product</th><th>Gross sales</th><th>Discounts</th><th>Returns</th><th>Retained net sales</th><th>Variable costs</th><th>Contribution</th><th>Margin</th><th>Source rows</th></>:<><th>Product</th><th>Unit cost</th><th>Packaging</th><th>Delivery</th><th>Payment fee</th><th>Basis</th><th>Source rows</th></>}</tr></thead><tbody>{products.map((p:any)=><tr key={p.productName} data-testid={`product-row-${p.productName}`}>{path==='/products'?<><td><strong>{p.productName}</strong></td><td className="mono">{money(p.grossSales,p.currency)}</td><td className="mono">{money(p.discounts,p.currency)}</td><td className="mono">{money(p.returns,p.currency)}</td><td className="mono">{money(p.retainedNetSales,p.currency)}</td><td className="mono">{money(p.variableCosts,p.currency)}</td><td className="mono"><strong>{money(p.contribution,p.currency)}</strong></td><td>{p.contributionMargin==null?'Unavailable':`${(p.contributionMargin*100).toFixed(1)}%`}</td><td>{p.sourceRowCount}</td></>:<><td><strong>{p.productName}</strong></td><td className="mono">Only reflected in aggregate variable-cost total</td><td className="mono">Not separately available</td><td className="mono">Not separately available</td><td className="mono">Not separately available</td><td>Source-backed aggregate</td><td>{p.sourceRowCount}</td></>}</tr>)}</tbody></table></div>}</section>;

  if(path==='/simulator')return <div className="grid grid-2"><section className="panel"><div className="panel-title"><div><h2>Save a price scenario</h2><p>Scenario output is an estimate under explicit changed assumptions.</p></div><SlidersHorizontal size={16} color="#0066ff"/></div><form onSubmit={e=>{e.preventDefault();const payload={companyId:company.id,productName:form.productName||'',name:form.name||'',newUnitPrice:Number(form.newUnitPrice),newDiscountPercent:Number(form.newDiscountPercent),newUnitCost:Number(form.newUnitCost)};safeMutation(mutations.saveScenario,payload,()=>setForm({}));}} data-testid="form-save-scenario"><Field label="Product name"><input className="input" required value={form.productName||''} onChange={e=>setForm({...form,productName:e.target.value})} data-testid="input-scenario-product"/></Field><Field label="Scenario name"><input className="input" required value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})} data-testid="input-scenario-name"/></Field><div className="grid grid-3">{[['newUnitPrice','Adjusted unit price'],['newDiscountPercent','Discount (%)'],['newUnitCost','Adjusted unit cost']].map(([k,label]:any)=><Field key={k} label={label}><input className="input" type="number" min="0" step="any" max={k==='newDiscountPercent'?100:undefined} required value={form[k]??''} onChange={e=>setForm({...form,[k]:e.target.value})} data-testid={`input-scenario-${k}`}/></Field>)}</div><div className="callout" style={{marginBottom:15}}>Saved scenario estimates are not actual results and do not change the analysis.</div><Button primary type="submit" disabled={mutations.saveScenario.isPending} testId="button-save-scenario"><Check size={14}/> Save scenario</Button></form></section><section className="panel"><div className="panel-title"><div><h2>Saved scenarios</h2><p>Assumptions saved to this company workspace.</p></div><span className="tag">{scenarios.length}</span></div>{scenarios.length===0?<EmptyState icon={SlidersHorizontal} title="No scenarios saved" detail="Set an explicit price, discount, and unit cost to model product contribution."/ >:<div className="table-wrap"><table><thead><tr><th>Scenario</th><th>Product</th><th>Price</th><th>Discount</th><th>Unit cost</th><th>Unit contribution</th><th>Baseline</th></tr></thead><tbody>{scenarios.map((s:any)=><tr key={s.id} data-testid={`scenario-row-${s.id}`}><td><strong>{s.name}</strong></td><td>{s.productName}</td><td className="mono">{money(s.newUnitPrice,currency)}</td><td>{s.newDiscountPercent}%</td><td className="mono">{money(s.newUnitCost,currency)}</td><td className="mono">{money(s.estimatedUnitContribution,currency)}</td><td className="mono">{s.baselineUnitContribution==null?'Unavailable':money(s.baselineUnitContribution,currency)}</td></tr>)}</tbody></table></div>}</section></div>;

  if(path==='/reports')return <div className="grid grid-2"><section className="panel"><div className="panel-title"><div><h2>Create a report</h2><p>Reports reference a persisted analysis record.</p></div><FileDown size={16} color="#0066ff"/></div>{!analysisId?<EmptyState icon={FileDown} title="A persisted analysis is required" detail="Run an analysis before creating a report." action={<Link href="/analysis" className="btn btn-primary btn-sm" data-testid="link-report-analysis">Run analysis</Link>}/>:<form onSubmit={e=>{e.preventDefault();safeMutation(mutations.createReport,{companyId:company.id,analysisId,title:form.title||''},()=>setForm({}));}} data-testid="form-create-report"><Field label="Report title"><input className="input" required maxLength={160} value={form.title||''} onChange={e=>setForm({...form,title:e.target.value})} data-testid="input-report-title"/></Field><div className="callout" style={{marginBottom:15}}>Reference analysis created {dateLabel(analysis.createdAt)} · period {dateLabel(analysis.periodStart)} — {dateLabel(analysis.periodEnd)}</div><Button primary type="submit" disabled={mutations.createReport.isPending} testId="button-create-report"><Plus size={14}/> Create report</Button></form>}</section><section className="panel"><div className="panel-title"><div><h2>Saved reports</h2><p>Exports are generated from persisted report records.</p></div></div>{reports.length===0?<EmptyState icon={FileDown} title="No reports yet" detail="Create a report linked to a saved analysis to export it."/>:<div className="table-wrap"><table><thead><tr><th>Report</th><th>Created</th><th>Analysis</th><th>Action</th></tr></thead><tbody>{reports.map((r:any)=><tr key={r.id} data-testid={`report-row-${r.id}`}><td><strong>{r.title}</strong></td><td>{dateLabel(r.createdAt)}</td><td className="mono">{r.analysisId.slice(0,10)}</td><td><Button className="btn-sm" onClick={()=>setExportingId(r.id)} testId={`button-export-report-${r.id}`}><Download size={13}/> Export</Button></td></tr>)}</tbody></table></div>}</section></div>;

  if(path==='/settings')return <section className="panel" style={{maxWidth:700}}><div className="panel-title"><div><h2>Reporting preferences</h2><p>Preferences are stored with your account.</p></div><Settings size={16} color="#0066ff"/></div>{!settings?<EmptyState icon={Settings} title="Settings unavailable" detail="Account preferences could not be loaded. Try again once your account is configured."/>:<form onSubmit={e=>{e.preventDefault();safeMutation(mutations.updateSettings,{currency:(form.currency||settings.currency).toUpperCase(),periodStartDay:Number(form.periodStartDay??settings.periodStartDay),notificationsEnabled:form.notificationsEnabled??settings.notificationsEnabled});}} data-testid="form-settings"><Field label="Default currency"><input className="input" maxLength={3} minLength={3} value={form.currency??settings.currency} onChange={e=>setForm({...form,currency:e.target.value.toUpperCase()})} data-testid="input-settings-currency"/></Field><Field label="Reporting period start day"><input className="input" type="number" min="1" max="28" value={form.periodStartDay??settings.periodStartDay} onChange={e=>setForm({...form,periodStartDay:e.target.value})} data-testid="input-period-start-day"/></Field><label style={{display:'flex',alignItems:'center',gap:10,fontSize:12,margin:'14px 0 22px'}}><input type="checkbox" checked={form.notificationsEnabled??settings.notificationsEnabled} onChange={e=>setForm({...form,notificationsEnabled:e.target.checked})} data-testid="input-notifications-enabled"/> Enable notifications for current findings</label><Button primary type="submit" testId="button-save-settings"><Check size={14}/> Save preferences</Button></form>}</section>;

  return <section className="panel"><EmptyState icon={CircleHelp} title="Page not found" detail="This route is not part of the MarginMind workspace." action={<Link href="/dashboard" className="btn btn-primary btn-sm" data-testid="link-return-dashboard">Return to dashboard</Link>}/></section>;
}

function qcInvalidateFindings(companyId?:string){if(companyId)queryClient.invalidateQueries({queryKey:getListFindingsQueryKey({companyId})});}
function AnalysisSummary({analysis}:any){return <div style={{marginTop:20}}><div className="grid grid-3"><div><div className="metric-label">Included rows</div><strong>{analysis.includedTransactionCount}</strong></div><div><div className="metric-label">Excluded rows</div><strong>{analysis.excludedTransactionCount}</strong></div><div><div className="metric-label">Currency</div><strong>{analysis.currency}</strong></div></div><div style={{marginTop:15,fontSize:11,color:'#6e7681'}}><strong>Methodology:</strong> {analysis.methodology}</div>{analysis.limitations?.length>0&&<div style={{marginTop:12}}>{analysis.limitations.map((l:string,i:number)=><span key={i} className="tag amber" style={{margin:'0 5px 5px 0'}}>{l}</span>)}</div>}</div>}
function StatementRow({label,value,strong=false,indent=true}:any){return <div style={{display:'flex',justifyContent:'space-between',padding:'15px 10px',borderBottom:'1px solid #edf0f3',fontSize:13,fontWeight:strong?700:500,background:strong?'#f7faff':'#fff'}}><span style={{paddingLeft:indent?14:0}}>{label}</span><span className="mono">{value}</span></div>}
function RevenueExpenseDetail({txns,currency,setPath}:any){
  const rows=txns.filter((r:any)=>r.isValid);const sums={revenue:0,expenses:0};let salesCount=0,expenseCount=0;
  rows.forEach((r:any)=>{if(r.amount==null)return;if(['sale','refund','discount'].includes(r.type)){sums.revenue+=Number(r.amount);salesCount++;}else if(['expense','shipping','cogs','fee','tax'].includes(r.type)){sums.expenses+=Number(r.amount);expenseCount++;}});
  return <><div className="grid grid-3"><Kpi label="Revenue-class rows" value={salesCount} note="Valid rows with sale, refund, or discount classification"/><Kpi label="Expense-class rows" value={expenseCount} note="Valid rows with expense, shipping, COGS, fee, or tax classification"/><Kpi label="Detail basis" value={rows.length} note="Valid source rows currently available in register"/></div><section className="panel" style={{marginTop:17}}><div className="panel-title"><div><h2>Row-class totals (loaded register)</h2><p>Source detail view, not an independently persisted P&amp;L.</p></div><span className="tag amber">Not a complete statement</span></div>{rows.length===0?<EmptyState icon={FileSearch} title="No validated transaction detail" detail="Import and validate source rows before revenue and expense detail can be inspected." action={<button className="btn btn-primary btn-sm" onClick={()=>setPath('/imports')} data-testid="button-revenue-import">Import records</button>}/>:<><StatementRow label="Revenue-class row total" value={money(sums.revenue,currency)} indent={false}/><StatementRow label="Expense-class row total" value={money(sums.expenses,currency)} indent={false}/><div className="callout" style={{marginTop:15}}>This view counts currently loaded source rows only. It is not a full-period total when the transaction register is paginated. Use the persisted analysis for period-level reconstruction.</div></>}</section></>;
}
function FindingCard({finding:f,update}:any){
  const [note,setNote]=useState(f.reviewNote||'');
  return <article style={{border:'1px solid #e7eaee',borderRadius:9,padding:17}} data-testid={`finding-card-${f.id}`}><div style={{display:'flex',justifyContent:'space-between',gap:12}}><div><div style={{display:'flex',gap:7,alignItems:'center',marginBottom:8}}><span className={`tag ${f.severity==='high'?'red':f.severity==='warning'?'amber':'blue'}`}>{f.severity}</span><span className="tag">{f.category}</span><span className="tag">{f.status}</span></div><h3 style={{font:'700 14px var(--app-font-serif)',margin:'0 0 6px'}}>{f.title}</h3><p style={{fontSize:11,color:'#6c747f',lineHeight:1.6,margin:0}}>{f.explanation}</p></div><AlertCircle size={16} color={f.severity==='high'?'#c43f37':'#b27b18'}/></div><div style={{marginTop:12,fontSize:10,color:'#77808b'}}>Source lines: {f.sourceLines?.length?f.sourceLines.map((n:number)=>`#${n}`).join(', '):'Not specified'} · {f.transactionIds?.length||0} linked transaction(s)</div><div className="field" style={{marginTop:13,marginBottom:10}}><label>Review note</label><input className="input" value={note} onChange={e=>setNote(e.target.value)} placeholder="Record your review context" data-testid={`input-finding-note-${f.id}`}/></div><div style={{display:'flex',gap:8}}>{f.status!=='reviewed'&&<button className="btn btn-sm" onClick={()=>update('reviewed',note)} data-testid={`button-review-finding-${f.id}`}><Check size={12}/> Mark reviewed</button>}{f.status!=='dismissed'&&<button className="btn btn-sm" onClick={()=>update('dismissed',note)} data-testid={`button-dismiss-finding-${f.id}`}>Dismiss</button>}{f.status!=='open'&&<button className="btn btn-sm" onClick={()=>update('open',note)} data-testid={`button-reopen-finding-${f.id}`}>Reopen</button>}</div></article>;
}

function HomeRedirect(){
  return <>
    <Show when="signed-in"><Redirect to="/dashboard"/></Show>
    <Show when="signed-out"><Landing/></Show>
  </>;
}
function ProtectedWorkspace(){
  return <>
    <Show when="signed-in"><Shell/></Show>
    <Show when="signed-out"><Redirect to="/"/></Show>
  </>;
}
function ClerkQueryClientCacheInvalidator(){
  const { addListener } = useClerk();
  const client = useQueryClient();
  const previousUserId = useRef<string|null|undefined>(undefined);
  useEffect(()=>{
    const unsubscribe=addListener(({user})=>{
      const nextUserId=user?.id??null;
      if(previousUserId.current!==undefined&&previousUserId.current!==nextUserId)client.clear();
      previousUserId.current=nextUserId;
    });
    return unsubscribe;
  },[addListener,client]);
  return null;
}
function Router(){
  return <Switch>
    <Route path="/" component={HomeRedirect}/>
    <Route path="/sign-in/*?" component={()=> <AuthPage/>}/>
    <Route path="/sign-up/*?" component={()=> <AuthPage signup/>}/>
    {Object.keys(titles).map(path=><Route key={path} path={path} component={ProtectedWorkspace}/>)}
    <Route component={()=> <ProtectedWorkspace/>}/>
  </Switch>;
}
function ClerkProviderWithRoutes(){
  const [,setLocation]=useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    signInFallbackRedirectUrl={`${basePath}/dashboard`}
    signUpFallbackRedirectUrl={`${basePath}/dashboard`}
    routerPush={(to)=>setLocation(stripBase(to))}
    routerReplace={(to)=>setLocation(stripBase(to),{replace:true})}
    localization={{
      signIn:{start:{title:'Welcome back',subtitle:'Sign in to access your MarginMind workspace'}},
      signUp:{start:{title:'Create your account',subtitle:'Start with your own source records'}},
    }}
  >
    <QueryClientProvider client={queryClient}>
      <ClerkQueryClientCacheInvalidator/>
      <Router/>
    </QueryClientProvider>
  </ClerkProvider>;
}
function App(){
  return <WouterRouter base={basePath}><ClerkProviderWithRoutes/></WouterRouter>;
}
export default App;
