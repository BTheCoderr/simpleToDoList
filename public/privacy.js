const ITERATIONS=120000;

function bytesToBase64(bytes){
  let binary="";
  bytes.forEach(byte=>binary+=String.fromCharCode(byte));
  return btoa(binary);
}
function base64ToBytes(value){
  const binary=atob(value);
  return Uint8Array.from(binary,ch=>ch.charCodeAt(0));
}
async function derive(code,salt,iterations=ITERATIONS){
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(code),"PBKDF2",false,["deriveBits"]);
  const bits=await crypto.subtle.deriveBits({name:"PBKDF2",salt,iterations,hash:"SHA-256"},key,256);
  return new Uint8Array(bits);
}
export async function createPrivacyCredential(code){
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const hash=await derive(code,salt);
  return {version:1,iterations:ITERATIONS,salt:bytesToBase64(salt),hash:bytesToBase64(hash)};
}
export async function verifyPrivacyCode(code,credential){
  if(!credential||credential.version!==1||!credential.salt||!credential.hash)return false;
  try{
    const actual=await derive(code,base64ToBytes(credential.salt),Number(credential.iterations)||ITERATIONS);
    const expected=base64ToBytes(credential.hash);
    if(actual.length!==expected.length)return false;
    let diff=0;for(let i=0;i<actual.length;i++)diff|=actual[i]^expected[i];
    return diff===0;
  }catch(e){return false}
}
