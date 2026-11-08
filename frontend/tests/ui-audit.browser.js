async (page) => {
  page.setDefaultTimeout(7000);
  await page.unroute("**/api/**");
  await (async (page) => {
  const state = { counts: {}, requests: [], role: "ADMIN", failures: new Set(), empty: false, delay: 0 };
  page.__uiAudit = state;
  const inputs = { AMT_CREDIT: 450000, NAME_CONTRACT_TYPE: "Cash loans", OCCUPATION_TYPE: "Accountants", DAYS_BIRTH: -12000, DAYS_EMPLOYED: -2500, AMT_ANNUITY: 25000, amount_unit: "HOME_CREDIT_SOURCE" };
  const prediction = { id: 12, case_id: 1, input_revision: 1, display_name: "Khách hàng HC 100001", inputs_snapshot: inputs, model_version: "home-credit-v1", algorithm: "Logistic Regression", data_source: "Home Credit", payment_difficulty_probability: .126, predicted_payment_difficulty: false, classification_threshold: .5, risk_level: "", credit_score: 780.7, created_at: "2026-11-08T08:00:00Z", response_json: { imputed_features: [], disclaimer: "", explanation_note: "" } };
  const record = { id: 1, source_application_id: 100001, display_name: "Khách hàng HC 100001", source: "Home Credit", inputs_json: inputs, input_revision: 1, reference_target: 0, created_at: prediction.created_at, updated_at: prediction.created_at, latest_prediction: prediction };
  state.record = record; state.prediction = prediction;
  await page.route("**/api/**", async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname;
    state.counts[path] = (state.counts[path] || 0) + 1;
    state.requests.push({ path, method: req.method(), body: req.postDataJSON(), query: url.search });
    if (req.method() === "OPTIONS") return route.fulfill({status:204,headers:{"access-control-allow-origin":"*","access-control-allow-headers":"*","access-control-allow-methods":"*"}});
    if(state.delay) await new Promise(resolve => setTimeout(resolve,state.delay));
    const user = { id: 1, full_name: "Nguyễn Minh Anh", email: "admin@credit-risk.com", role: state.role, is_active: true, created_at: prediction.created_at, updated_at: prediction.created_at };
    let body;
    if (state.failures.has(path)) return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({detail:"Lỗi đọc dữ liệu thử nghiệm"}), headers:{"access-control-allow-origin":"*"} });
    if (path === "/api/auth/me") body = user;
    else if (path === "/api/auth/login") body = { access_token: "ui-audit-token", user };
    else if (path === "/api/auth/register") body = user;
    else if (path === "/api/credit-cases/summary") body = { total_cases: state.empty ? 0 : 307511, total_predictions: 1280, assessed_cases: 945, source: "Home Credit application_train.csv", identity_note: "Định danh khách hàng đã được ẩn danh trong dữ liệu nguồn." };
    else if (path === "/api/home-credit/input-schema") body = { amount_unit: "HOME_CREDIT_SOURCE", features: {
      AMT_CREDIT: { kind:"number", nullable:false,label:"Số tiền tín dụng",unit:"Thang Home Credit"},
      NAME_CONTRACT_TYPE: { kind:"string",nullable:false,label:"Loại hợp đồng",unit:"",choices:["Cash loans","Revolving loans"]},
      OCCUPATION_TYPE: { kind:"string",nullable:true,label:"Nghề nghiệp",unit:"",choices:["Accountants","Laborers"]},
      DAYS_BIRTH: {kind:"integer",nullable:false,label:"Ngày sinh",unit:"ngày so với ngày nộp hồ sơ"},
      DAYS_EMPLOYED: {kind:"integer",nullable:true,label:"Ngày bắt đầu việc",unit:"ngày so với ngày nộp hồ sơ"},
      AMT_ANNUITY: {kind:"number",nullable:true,label:"Số tiền trả theo kỳ",unit:"Thang Home Credit"}
    }};
    else if (path === "/api/credit-cases/predictions") body = {items:state.empty?[]:[prediction],total:state.empty?0:25,page:Number(url.searchParams.get("page")||1),page_size:10};
    else if (path === "/api/credit-cases/1/predictions") body = state.empty?[]:[prediction];
    else if (path === "/api/credit-cases/1/score") body = prediction;
    else if (path === "/api/credit-cases/1/inputs" || path === "/api/credit-cases/1") body = record;
    else if (path === "/api/credit-cases") body = req.method()==="POST"?record:{items:state.empty?[]:[{...record,display_name:url.searchParams.get("q")||record.display_name}],total:state.empty?0:25,page:Number(url.searchParams.get("page")||1),page_size:10};
    else if (path === "/api/users") body = req.method()==="POST"?user:{items:state.empty?[]:[user,{...user,id:2,full_name:"Trần Quốc Bảo",email:"officer@credit-risk.com",role:"OFFICER"}],total:state.empty?0:12,page:1,page_size:8};
    else if (/^\/api\/users\/\d+$/.test(path)) body = user;
    else if(path === "/api/models/current") body = {version:"home-credit-v1",algorithm:"Logistic Regression",training_dataset:"Home Credit",selection_policy:"AP",classification_threshold:.5,credit_score_formula:"850 - 550 * P(TARGET=1)",risk_bands:{status:"unvalidated"},cv_results:{models:{"Logistic Regression":{summary:{ap_mean:.245,ap_std:.012,roc_auc_mean:.751,roc_auc_std:.009}}}},test_metrics:{average_precision:.241,roc_auc:.75}};
    else if(path === "/api/models") body = state.empty?[]:[{id:1,model_name:"Home Credit",version:"v1",algorithm:"Logistic Regression",training_dataset:"Home Credit",status:"ACTIVE",created_at:prediction.created_at}];
    else body = {};
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body), headers:{"access-control-allow-origin":"*"} });
  });
  await page.goto("http://localhost:5173/login");
  await page.evaluate(()=>localStorage.setItem("access_token","ui-audit-token"));
  await page.goto("http://localhost:5173/");
  await page.getByRole("heading",{name:"Tổng quan dữ liệu Home Credit",exact:true}).waitFor();
  await page.getByText("307.511",{exact:true}).waitFor();
  return {title:await page.title(), heading:await page.locator("h1").allTextContents(), counts:state.counts};
})(page);
  const state = page.__uiAudit;
  const checks = [];
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const check = (condition, name) => { if (!condition) throw new Error(name); checks.push(name); };
  const paths = ["/","/customers","/loans","/customers/new","/customers/1","/loans/1","/risk-assessment","/risk-assessment/1","/predictions","/models","/users"];
  const responsive = [];
  for (const path of paths) {
    await page.goto("http://localhost:5173"+path);
    await page.locator("h1").waitFor();
    await page.locator('[aria-busy="true"]').waitFor({state:"hidden"});
    for (const width of [320,375,768,1024,1440]) {
      await page.setViewportSize({width,height:900});
      const screen=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,h1:document.querySelectorAll("h1").length,missing:Array.from(document.querySelectorAll("main input:not([type=checkbox]),main select")).filter(e=>!e.labels?.length && !e.getAttribute("aria-label")).length}));
      check(screen.scroll<=screen.width && screen.h1===1 && !screen.missing, "responsive "+path+" "+width);
      responsive.push({path,...screen});
    }
  }
  await page.setViewportSize({width:375,height:812});
  await page.goto("http://localhost:5173/");
  const menu=page.getByRole("button",{name:/Menu/});
  await menu.click();
  check(await page.locator("dialog").evaluate(d=>d.open),"drawer opens");
  check(await page.evaluate(()=>document.activeElement.textContent.includes("Đóng menu")),"drawer initial focus");
  await page.keyboard.press("Shift+Tab");
  check(await page.locator("dialog").evaluate(d=>d.contains(document.activeElement)),"drawer Shift+Tab trap");
  await page.keyboard.press("Tab");
  check(await page.locator("dialog").evaluate(d=>d.contains(document.activeElement)),"drawer Tab trap");
  await page.keyboard.press("Escape");
  await page.waitForFunction(()=>document.body.style.overflow==="");
  check(await menu.evaluate(b=>document.activeElement===b),"Escape restores focus and scroll");
  await menu.click();
  await page.getByRole("dialog").getByRole("link",{name:"Khách hàng",exact:true}).click();
  await page.waitForURL("**/customers");
  check(await page.locator("dialog").evaluate(d=>!d.open),"drawer closes on navigation");
  check(await page.evaluate(()=>document.activeElement.id==="main-content"),"navigation focuses main");
  await page.getByRole("button",{name:"Sau →",exact:true}).click();
  await page.getByRole("navigation",{name:"Phân trang"}).getByText("2",{exact:true}).waitFor();
  check(true,"pagination next");
  await page.goto("http://localhost:5173/risk-assessment");
  await page.getByRole("button",{name:"Nhập hồ sơ mới",exact:true}).click();
  await page.getByLabel("Tên hoặc mã khách hàng",{exact:true}).waitFor();
  check(await page.locator("h1").count()===1,"create inside assessment has one h1");
  await page.getByLabel("Tôi xác nhận",{exact:false}).check();
  await page.getByRole("button",{name:"Dự đoán và lưu kết quả",exact:true}).click();
  check(await page.evaluate(()=>document.activeElement.id==="case-name" && document.activeElement.getAttribute("aria-invalid")==="true"),"native validation focuses first invalid field");
  await page.goto("http://localhost:5173/predictions");
  await page.getByRole("button",{name:/Xem kết quả số/}).click();
  check(await page.evaluate(()=>document.activeElement.textContent==="Kết quả đã lưu #12"),"prediction selection focuses result");

  await page.route(/\/api\/credit-cases\?/, async route => {
    const q=new URL(route.request().url()).searchParams.get("q")||"";
    await new Promise(resolve=>setTimeout(resolve,q==="old"?700:50));
    await route.fulfill({status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},body:JSON.stringify({items:[{...state.record,display_name:q||state.record.display_name}],total:1,page:1,page_size:10})});
  });
  await page.goto("http://localhost:5173/customers");
  await page.locator("table").waitFor();
  const search=page.getByLabel("Tên hoặc mã hồ sơ nguồn",{exact:true});
  await search.fill("old"); await search.press("Enter");
  await search.fill("new"); await search.press("Enter");
  await page.getByRole("link",{name:"new",exact:true}).waitFor();
  await page.waitForTimeout(850);
  check(await page.getByRole("link",{name:"new",exact:true}).isVisible(),"latest search wins reversed responses");
  await page.unroute(/\/api\/credit-cases\?/);

  await page.goto("http://localhost:5173/risk-assessment/1");
  const score=page.getByRole("button",{name:"Dự đoán và lưu kết quả",exact:true});
  await score.waitFor();
  state.delay=350;
  const beforeScore=state.requests.length;
  await score.evaluate(b=>{ b.form.requestSubmit(); b.form.requestSubmit(); });
  check(await page.locator("fieldset").evaluate(f=>f.disabled),"assessment inputs locked");
  await page.getByRole("status").filter({hasText:"Đã lưu dự đoán"}).waitFor();
  const scoreWrites=state.requests.slice(beforeScore).filter(r=>r.method==="PUT"||r.method==="POST");
  check(scoreWrites.length===2 && scoreWrites[0].path==="/api/credit-cases/1/inputs" && scoreWrites[1].path==="/api/credit-cases/1/score","double score creates exactly one save and one score");
  check(scoreWrites[0].body.expected_revision===1 && Object.keys(scoreWrites[0].body.inputs).length===Object.keys(state.record.inputs_json).length && Object.entries(state.record.inputs_json).every(([key,value])=>scoreWrites[0].body.inputs[key]===value) && JSON.stringify(scoreWrites[1].body)===JSON.stringify({expected_revision:1}),"score payload unchanged");
  state.delay=0;
  const beforeSave=state.requests.length;
  await page.getByRole("button",{name:"Chỉ lưu thông tin",exact:true}).click();
  await page.getByRole("status").filter({hasText:"Đã lưu đầu vào"}).waitFor();
  const saveWrites=state.requests.slice(beforeSave).filter(r=>r.method==="PUT"||r.method==="POST");
  check(saveWrites.length===1 && saveWrites[0].method==="PUT","save-only never scores");

  await page.goto("http://localhost:5173/users");
  await page.getByLabel("Họ tên",{exact:true}).fill("Nhân viên thử nghiệm");
  await page.getByLabel("Email",{exact:true}).fill("test@example.com");
  await page.getByLabel("Mật khẩu",{exact:true}).fill("Example123!");
  state.delay=350;
  const beforeCreate=state.requests.length;
  await page.getByRole("button",{name:"Tạo tài khoản",exact:true}).evaluate(b=>{b.form.requestSubmit();b.form.requestSubmit();});
  check(await page.getByRole("button",{name:"Đang tạo tài khoản…"}).isDisabled(),"user create disabled while pending");
  await page.getByRole("status").filter({hasText:"Đã tạo người dùng"}).waitFor();
  const creates=state.requests.slice(beforeCreate).filter(r=>r.path==="/api/users"&&r.method==="POST");
  check(creates.length===1 && creates[0].body.role==="OFFICER","user double submit creates one OFFICER");
  await page.locator("table").waitFor();
  const beforeToggle=state.requests.length;
  await page.getByRole("button",{name:/Khóa tài khoản/}).evaluate(b=>{b.click();b.click();});
  await page.getByRole("status").filter({hasText:"Đã khóa tài khoản"}).waitFor();
  check(state.requests.slice(beforeToggle).filter(r=>r.path==="/api/users/2"&&r.method==="PUT").length===1,"toggle protected from repeat click");
  state.delay=0;
  await page.goto("http://localhost:5173/models");
  await page.getByRole("heading",{name:"Registry lịch sử",exact:true}).waitFor();
  const modelsCount=state.counts["/api/models/current"];
  await page.waitForTimeout(6200);
  check(state.counts["/api/models/current"]===modelsCount,"toast expiry does not refetch models");
  state.failures.add("/api/models/current");
  await page.reload();
  await page.getByRole("alert").filter({hasText:"Lỗi đọc dữ liệu thử nghiệm"}).waitFor();
  const failedCount=state.counts["/api/models/current"];
  await page.waitForTimeout(600);
  check(state.counts["/api/models/current"]===failedCount,"failed model read does not loop");
  state.failures.clear();
  await page.getByRole("button",{name:"Thử lại",exact:true}).click();
  await page.getByRole("heading",{name:"Registry lịch sử",exact:true}).waitFor();
  check(true,"read retry succeeds");

  state.empty=true;
  for(const path of ["/customers","/predictions","/users","/models"]) {
    await page.goto("http://localhost:5173"+path);
    await page.getByRole("status").filter({hasText:/Chưa có/}).waitFor();
    check(true,"empty "+path);
  }
  await page.goto("http://localhost:5173/customers");
  const emptySearch=page.getByLabel("Tên hoặc mã hồ sơ nguồn",{exact:true});
  await emptySearch.fill("không khớp"); await emptySearch.press("Enter");
  await page.getByRole("status").filter({hasText:"Không tìm thấy hồ sơ phù hợp"}).waitFor();
  check(true,"empty dataset differs from no search matches");
  state.empty=false;
  state.delay=500;
  await page.goto("http://localhost:5173/predictions");
  await page.getByRole("status").filter({hasText:"Đang tải dữ liệu"}).waitFor();
  check(true,"initial loading on slow network");
  await page.locator("table").waitFor();
  state.delay=0;
  await page.goto("http://localhost:5173/customers/new");
  await page.getByLabel("Tên hoặc mã khách hàng",{exact:true}).fill("Giữ dữ liệu khi lỗi");
  for(const [id,value] of Object.entries({AMT_CREDIT:"123456",DAYS_BIRTH:"-12000",DAYS_EMPLOYED:"-2500",AMT_ANNUITY:"15000"})) await page.locator("#"+id).fill(value);
  await page.locator("#NAME_CONTRACT_TYPE").selectOption("Cash loans");
  await page.locator("#OCCUPATION_TYPE").selectOption("Accountants");
  await page.getByLabel("Tôi xác nhận",{exact:false}).check();
  state.failures.add("/api/credit-cases");
  await page.getByRole("button",{name:"Dự đoán và lưu kết quả",exact:true}).click();
  await page.getByRole("alert").filter({hasText:"Lỗi đọc dữ liệu thử nghiệm"}).waitFor();
  check(await page.locator("#AMT_CREDIT").inputValue()==="123456" && await page.locator("#case-name").inputValue()==="Giữ dữ liệu khi lỗi","failed write retains input");
  state.failures.clear();
  const axeSource=await page.request.get("https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.3/axe.min.js").then(r=>r.text());
  const accessibility=[];
  for(const path of paths) {
    await page.goto("http://localhost:5173"+path);
    await page.locator("h1").waitFor();
    await page.locator('[aria-busy="true"]').waitFor({state:"hidden"});
    await page.addScriptTag({content:axeSource});
    const violations=await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));
    accessibility.push({path,violations});
    check(!violations.length,"axe "+path);
  }
  await page.goto("http://localhost:5173/");
  await page.getByRole("button",{name:/Menu/}).click();
  await page.addScriptTag({content:axeSource});
  const drawerViolations=await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]}})).violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})));
  check(!drawerViolations.length,"axe open mobile drawer");
  await page.keyboard.press("Escape");

  state.role="OFFICER";
  await page.goto("http://localhost:5173/users");
  await page.waitForURL("http://localhost:5173/");
  check(!await page.getByRole("link",{name:"Người dùng",exact:true}).count(),"OFFICER cannot access users");
  state.role="RETIRED";
  await page.goto("http://localhost:5173/risk-assessment");
  await page.waitForURL("**/loans");
  check(true,"retired role cannot access writer route");
  state.role="ADMIN";
  await page.goto("http://localhost:5173/");
  await page.getByRole("button",{name:/Menu/}).click();
  await page.getByRole("dialog").getByRole("button",{name:"Đăng xuất",exact:true}).click();
  await page.waitForURL("**/login");
  check(await page.evaluate(()=>localStorage.getItem("access_token")===null),"logout clears token");
  for(const width of [320,375,768,1024,1440]){
    await page.setViewportSize({width,height:900});
    check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"login responsive "+width);
  }
  await page.addScriptTag({content:axeSource});
  const loginAxe=await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]}})).violations.map(v=>v.id));
  check(!loginAxe.length,"axe login");
  await page.getByRole("button",{name:"Chưa có tài khoản? Đăng ký",exact:true}).click();
  check(await page.getByLabel("Họ tên",{exact:true}).isVisible(),"register form accessible");
  await page.getByRole("button",{name:"Đã có tài khoản? Đăng nhập",exact:true}).click();
  await page.getByRole("button",{name:"Đăng nhập",exact:true}).click();
  await page.waitForURL("http://localhost:5173/");
  check(true,"mock login returns dashboard");
  const successToast=page.locator(".toast-success").last();
  await successToast.waitFor();
  check(await successToast.evaluate(e=>getComputedStyle(e).backgroundColor!=="rgba(0, 0, 0, 0)"),"success toast has opaque surface");
  await page.addScriptTag({content:axeSource});
  const toastAxe=await page.evaluate(async()=> (await axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"]}})).violations.map(v=>v.id));
  check(!toastAxe.length,"axe success toast");
  while(await page.getByRole("button",{name:"Đóng thông báo",exact:true}).count()) await page.getByRole("button",{name:"Đóng thông báo",exact:true}).first().click();
  check(!errors.length,"no uncaught JavaScript errors");
  await page.setViewportSize({width:1440,height:1000});
  await page.getByText("307.511",{exact:true}).waitFor();
  await page.screenshot({path:"frontend/test-results/dashboard-desktop.png",fullPage:true});
  await page.setViewportSize({width:375,height:812});
  await page.goto("http://localhost:5173/risk-assessment/1");
  await page.getByRole("button",{name:"Dự đoán và lưu kết quả",exact:true}).waitFor();
  await page.screenshot({path:"frontend/test-results/assessment-mobile.png",fullPage:true});
  return {environment:"production preview; mocked API; Chromium",checks, responsive, accessibility,loginAxe,drawerViolations,errors,scoreWrites};
}