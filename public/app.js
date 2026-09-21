/* Première étape : invitation. Les futures sections restent indépendantes de cette scène. */
const welcome = document.querySelector('#welcome');
const invitation = document.querySelector('#invitation');
const weddingContent = document.querySelector('#wedding-content');
const openButton = document.querySelector('#open-invitation');
const openText = document.querySelector('#open-text');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let phase = 'closed';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function openInvitation() {
  if (phase !== 'closed') return;
  phase = 'opening'; openButton.disabled = true; openText.disabled = true;
  const envelopeArt = new Image();
  envelopeArt.src = 'olive-envelope.webp';
  try { await envelopeArt.decode(); } catch { /* Keep invitation accessible if artwork fails. */ }
  document.body.classList.add('envelope-opening');
  welcome.classList.add('opening');
  await delay(reducedMotion.matches ? 50 : 4600);
  welcome.hidden = true;
  weddingContent.inert = false;
  document.body.classList.remove('envelope-closed', 'envelope-opening');
  document.body.classList.add('invitation-ready');
  openButton.setAttribute('aria-expanded', 'true');
  window.scrollTo({top:0,behavior:'instant'});
  document.querySelector('#invitation-title').focus({preventScroll:true});
  phase = 'open';
}
openButton.addEventListener('click',openInvitation);
openText.addEventListener('click',openInvitation);
document.querySelector('#replay').addEventListener('click',() => {
  weddingContent.inert = true; welcome.hidden = false;
  document.body.classList.remove('invitation-ready');
  document.body.classList.add('envelope-closed');
  welcome.classList.remove('opening');
  openButton.disabled = false; openText.disabled = false;
  openButton.setAttribute('aria-expanded','false'); phase = 'closed';
  window.scrollTo({top:0,behavior:'instant'}); openText.focus({preventScroll:true});
});

// Apparitions progressives sans masquer le contenu en cas de JavaScript indisponible.
if ('IntersectionObserver' in window && !reducedMotion.matches) {
  document.documentElement.classList.add('js-reveal');
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
  }), {threshold:.08});
  document.querySelectorAll('.scroll-reveal').forEach(element => observer.observe(element));
}
const form = document.querySelector('#rsvp-form');
const attendanceDetails = document.querySelector('#attending-details');
const submitButton = document.querySelector('#rsvp-submit');
const formStatus = document.querySelector('#form-status');
function newSubmissionId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
let submissionId = newSubmissionId();
let previousPayload = '';
function syncAttendance() {
  const yes = form.elements.attending.value === 'yes';
  attendanceDetails.hidden = !yes;
  attendanceDetails.querySelectorAll('input,textarea,select').forEach(input => input.disabled = !yes);
  form.querySelectorAll('[name=plusOne]').forEach(input => input.required = yes);
  const plusOne = yes && form.elements.plusOne.value === 'yes';
  document.querySelector('#companion-field').hidden = !plusOne;
  form.elements.companion.required = plusOne;
  const children = yes && Number(form.elements.children.value) > 0;
  document.querySelector('#children-field').hidden = !children;
  form.elements.childrenNames.required = children;
}
form.elements.children.addEventListener('input',syncAttendance);
form.querySelectorAll('[name=attending],[name=plusOne],#children').forEach(input => input.addEventListener('change',syncAttendance));
syncAttendance();
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const values = new FormData(form);
  const yes = values.get('attending') === 'yes';
  const payload = {
    name:values.get('name'),email:values.get('email'),phone:values.get('phone'),attending:values.get('attending'),
    plusOne:yes && values.get('plusOne') === 'yes',companion:yes?(values.get('companion')||''):'',
    children:yes?Number(values.get('children')):0,childrenNames:yes?(values.get('childrenNames')||''):'',
    events:[],dietary:yes?(values.get('dietary')||''):'',
    accessibility:yes?(values.get('accessibility')||''):'',message:values.get('message')||'',
    website:values.get('website')||'',consent:values.has('consent')
  };
  const signature = JSON.stringify(payload);
  if (previousPayload && previousPayload !== signature) submissionId = newSubmissionId();
  previousPayload = signature;
  submitButton.disabled = true; submitButton.textContent = 'Envoi en cours…'; formStatus.textContent = '';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(),20000);
  try {
    const response = await fetch('/api/rsvp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,id:submissionId}),signal:controller.signal});
    const result = await response.json();
    if (!response.ok || result.ok !== true) throw new Error(result.error || 'Votre réponse n’a pas pu être enregistrée. Veuillez réessayer.');
    form.hidden = true;
    const success = document.querySelector('#rsvp-success'); success.hidden = false;
    document.querySelector('#success-copy').textContent = yes ? 'Nous sommes heureux de vous compter parmi nous le 15 mai ! Vos informations ont bien été prises en compte.' : 'Merci de nous avoir prévenus. Nous penserons bien à vous lors de cette journée.';
    success.focus({preventScroll:true}); success.scrollIntoView({behavior:reducedMotion.matches?'instant':'smooth',block:'center'});
  } catch (error) {
    formStatus.textContent = error.name === 'AbortError' ? 'La connexion prend trop de temps. Votre saisie est conservée ; vous pouvez réessayer sans envoyer deux fois la même réponse.' : (error instanceof TypeError ? 'La connexion a échoué. Votre saisie est conservée : vérifiez votre connexion puis réessayez.' : error.message);
  } finally { clearTimeout(timeout); submitButton.disabled = false; submitButton.textContent = 'Envoyer ma réponse ↗'; }
});

// Date absolue : cérémonie à 15h en France (UTC+2 en mai).
const weddingAt = Date.parse('2027-05-15T15:00:00+02:00');
function updateCountdown() {
  const remaining = Math.max(0, Math.ceil((weddingAt - Date.now()) / 1000));
  const parts = {days:Math.floor(remaining/86400),hours:Math.floor(remaining/3600)%24,minutes:Math.floor(remaining/60)%60,seconds:remaining%60};
  for (const [unit,value] of Object.entries(parts)) document.querySelector('#count-'+unit).textContent=String(value).padStart(2,'0');
  document.querySelector('.countdown-units').hidden = remaining === 0;
  document.querySelector('.countdown-heading').hidden = remaining === 0;
  document.querySelector('#countdown-finished').hidden = remaining > 0;
  if (!remaining) clearInterval(countdownTimer);
}
let countdownTimer = setInterval(updateCountdown,1000);
updateCountdown();
document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateCountdown();});
