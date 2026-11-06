import * as m11 from './m11.js';
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = x => x == null ? 'undefined' : Number(x).toFixed(3);
const pct = x => m11.fmtPct(x);
const num = x => Number(x).toLocaleString('en-US');
const labels = ['1. Beyond Accuracy','2. A Threshold for the Job','3. Training vs. Test'];
const state = {section:0, dataset:'readmission', model:'logreg', threshold:0.3};
const cache = {};
async function load(key) {
  if (!Object.hasOwn(cache,key)) {
    const response = await fetch(`../results/${key}.json`);
    if (!response.ok) throw Error(`Could not load results/${key}.json`);
    cache[key] = await response.json();
  }
  return cache[key];
}
function table(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(v=>`<td>${escapeHtml(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function summary(res) {
  return `<p class="caption">Training: ${num(res.train.n)} patients (${num(res.train.n_pos)} positive). Test: ${num(res.test.n)} patients (${num(res.test.n_pos)} positive). All interactive metrics below are explicitly labeled by split.</p>`;
}
function matrix(c, label) {
  return `<div class="matrix"><h3>${escapeHtml(label)} confusion matrix</h3>${table(['','Predicted positive','Predicted negative'],[['Actually positive (outcome)',num(c.tp)+' true positives',num(c.fn)+' missed cases'],['Actually negative',num(c.fp)+' false alarms',num(c.tn)+' true negatives']])}</div>`;
}
function metricsTable(c) {
  const m=m11.metrics(c);
  return table(['Accuracy','Sensitivity / recall','Specificity','False positive rate','Precision','F1','Flagged per 100'],[[pct(m.accuracy),pct(m.sensitivity),pct(m.specificity),pct(m.fpr),pct(m.precision),fmt(m.f1),fmt(m.flagged_per_100)]]);
}
function section1(res) {
  const y=res.test.y;
  const rows=m11.MODELS.filter(model=>res.models[model]).map(model=>{
    const c=m11.confusion(...m11.preds(res,model,'test'),0.5);
    const m=m11.metrics(c);
    return [m11.MODEL_LABEL[model],num(c.tp),num(c.fn),num(c.fp),num(c.tn),pct(m.accuracy),pct(m.sensitivity),pct(m.specificity),pct(m.fpr),pct(m.precision),fmt(m.f1)];
  });
  const c=m11.confusion(...m11.preds(res,state.model,'test'),0.5);
  return `<h3>Test patients · threshold 0.50 · all models</h3><p>Positive means ${state.dataset==='readmission'?'readmitted within 30 days':'diabetes screening label positive'}. Accuracy counts all correct predictions, even when positive outcomes are uncommon.</p>`+
    `<p class="info">Test majority-class accuracy: ${pct(m11.majorityAccuracy(y))}. Compare this with the sensitivity column: of patients who had the outcome, how many did the model flag?</p>`+
    table(['Model','TP','FN','FP','TN','Accuracy','Sensitivity','Specificity','FPR','Precision','F1'],rows)+
    matrix(c,`Test · ${m11.MODEL_LABEL[state.model]} · 0.50`)+
    `<p class="caption">TP = outcome correctly flagged; FN = outcome missed; FP = false alarm; TN = correctly not flagged. Precision is undefined if no patients are flagged.</p>`;
}
function section2(res) {
  const [p,y]=m11.preds(res,state.model,'test');
  const a=m11.confusion(p,y,0.5), b=m11.confusion(p,y,state.threshold);
  const ma=m11.metrics(a),mb=m11.metrics(b);
  const vals=(label,c,m)=>[label,num(c.tp),num(c.fn),num(c.fp),num(c.tn),pct(m.sensitivity),pct(m.specificity),pct(m.precision),fmt(m.flagged_per_100)];
  return `<h3>Test patients · adjustable decision threshold</h3><p>The same trained model produces probabilities; the threshold determines who is flagged for follow-up. A lower threshold generally catches more positives but creates more false alarms.</p>`+
    `<label class="slider">Threshold <input id="threshold-slider" type="range" min="0.05" max="0.95" step="0.05" value="${state.threshold}"><output id="threshold-value">${state.threshold.toFixed(2)}</output></label>`+
    table(['Test threshold','TP','Missed cases (FN)','False alarms (FP)','TN','Sensitivity','Specificity','Precision','Flagged / 100'],[vals('0.50 (reference)',a,ma),vals(state.threshold.toFixed(2),b,mb)])+
    `<div class="cols">${matrix(a,'Test · 0.50')}${matrix(b,`Test · ${state.threshold.toFixed(2)}`)}</div>`+
    `<p class="info">Compared with test threshold 0.50: ${num(a.fn-b.fn)} fewer missed positive cases and ${num(b.fp-a.fp)} additional false alarms. Interpret these as counts on the supplied test patients, not forecasts for every clinic.</p>`;
}
function section3(res) {
  const rows=m11.MODELS.filter(m=>res.models[m]).map(model=>{
    const [trainP,trainY]=m11.preds(res,model,'train'),[testP,testY]=m11.preds(res,model,'test');
    const tr=m11.metrics(m11.confusion(trainP,trainY,0.5));
    const te=m11.metrics(m11.confusion(testP,testY,0.5));
    const s=m11.aurocSummary(res)[model];
    return [m11.MODEL_LABEL[model],pct(tr.accuracy),pct(te.accuracy),pct(tr.sensitivity),pct(te.sensitivity),fmt(s.train),fmt(s.test),fmt(s.gap)];
  });
  const model=state.model;
  const [pTrain,yTrain]=m11.preds(res,model,'train'),[pTest,yTest]=m11.preds(res,model,'test');
  const train=m11.metrics(m11.confusion(pTrain,yTrain,0.5)),test=m11.metrics(m11.confusion(pTest,yTest,0.5));
  return `<h3>Training versus test patients · all models</h3><p>Training patients were used to fit the models. Test patients were held out and better represent how a model might perform on unseen cases from a similar population.</p>`+
    table(['Model','Training accuracy','Test accuracy','Training sensitivity','Test sensitivity','Training AUROC','Test AUROC','AUROC gap (train − test)'],rows)+
    `<div class="cols">${matrix(m11.confusion(pTrain,yTrain,0.5),`Training · ${m11.MODEL_LABEL[model]}`)}${matrix(m11.confusion(pTest,yTest,0.5),`Test · ${m11.MODEL_LABEL[model]}`)}</div>`+
    `<p class="info">Selected model, threshold 0.50: training accuracy ${pct(train.accuracy)} versus test accuracy ${pct(test.accuracy)}. A large gap can suggest overfitting; it does not prove the model will work in a different health system.</p>`+
    `<p class="caption">AUROC measures ranking, not accuracy. It does not select a clinical threshold.</p>`;
}
async function recommendations() {
  const d=await load('decisions');
  const rec=d.recommendations || {};
  $('recommendations-body').innerHTML=m11.DATASETS.map(k=>`<p><strong>${escapeHtml(m11.DATASET_LABEL[k])}:</strong> ${rec[k]?escapeHtml(rec[k]):'<em>Student recommendation pending in DECISIONS.md</em>'}</p>`).join('');
}
async function render() {
  try {
    const res=await load(state.dataset);
    $('section-title').textContent=labels[state.section];
    $('context').innerHTML=summary(res);
    $('content').innerHTML= !res.models[state.model] ? `<p class="warn">${escapeHtml(m11.MODEL_LABEL[state.model])} results not yet exported. After completing your Before results decisions, run python -m analysis.</p>` : [section1,section2,section3][state.section](res);
    const slider=$('threshold-slider');
    if(slider) slider.addEventListener('input',e=>{state.threshold=Number(e.target.value);render();});
  } catch(err) { $('content').innerHTML=`<p class="warn">${escapeHtml(err.message)}. Check that results/ exists and the app is served through GitHub Pages or the local launcher.</p>`; }
}
function init() {
  $('sections').innerHTML=labels.map((label,i)=>`<label class="radio"><input type="radio" name="section" value="${i}" ${i===0?'checked':''}>${escapeHtml(label)}</label>`).join('');
  $('dataset').innerHTML=m11.DATASETS.map(k=>`<option value="${k}">${escapeHtml(m11.DATASET_LABEL[k])}</option>`).join('');
  $('model').innerHTML=m11.MODELS.map(k=>`<option value="${k}">${escapeHtml(m11.MODEL_LABEL[k])}</option>`).join('');
  $('dataset').value=state.dataset; $('model').value=state.model;
  $('sections').addEventListener('change',e=>{state.section=Number(e.target.value);render();});
  $('dataset').addEventListener('change',e=>{state.dataset=e.target.value;render();});
  $('model').addEventListener('change',e=>{state.model=e.target.value;render();});
  recommendations().catch(()=>{});render();
}
init();
