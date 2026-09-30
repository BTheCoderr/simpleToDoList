export const APP_VERSION="7.3.0";
export const DB_NAME="command-center-v2"; // Kept intentionally so existing local data is preserved.
export const DB_VERSION=4;
export const STORES=["tasks","projects","notes","habits","activity","templates","goals","snapshots","meta"];
export const DATA_STORES=["tasks","projects","notes","habits","activity","templates","goals"];
export const MAX_SNAPSHOT_BYTES=4*1024*1024;
export const MAX_SNAPSHOTS=7;

export const MIGRATIONS={
  1:["tasks","projects","notes","habits","activity"],
  2:["templates"],
  3:["goals","snapshots"],
  4:["meta"]
};

function ensureStore(db,name){
  if(!db.objectStoreNames.contains(name))db.createObjectStore(name,{keyPath:"id"});
}

export function runMigrations(db,tx,oldVersion,newVersion){
  for(let v=oldVersion+1;v<=newVersion;v++){
    (MIGRATIONS[v]||[]).forEach(name=>ensureStore(db,name));
  }
  if(db.objectStoreNames.contains("meta")){
    tx.objectStore("meta").put({
      id:"schema",
      version:newVersion,
      appVersion:APP_VERSION,
      upgradedAt:new Date().toISOString()
    });
  }
}

export function openDB(){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,DB_VERSION);
    request.onupgradeneeded=event=>runMigrations(request.result,request.transaction,event.oldVersion,event.newVersion||DB_VERSION);
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
    request.onblocked=()=>reject(new Error("Database upgrade blocked by another open Command Center tab"));
  });
}

export function all(store){
  return openDB().then(db=>new Promise((resolve,reject)=>{
    const request=db.transaction(store,"readonly").objectStore(store).getAll();
    request.onsuccess=()=>{db.close();resolve(request.result||[])};
    request.onerror=()=>{db.close();reject(request.error)};
  }));
}

export function readStores(names){
  return openDB().then(db=>new Promise((resolve,reject)=>{
    const output={};
    const tx=db.transaction(names,"readonly");
    names.forEach(name=>{
      const request=tx.objectStore(name).getAll();
      request.onsuccess=()=>{output[name]=request.result||[]};
    });
    tx.oncomplete=()=>{db.close();resolve(output)};
    tx.onerror=()=>{const error=tx.error;db.close();reject(error)};
    tx.onabort=()=>{const error=tx.error||new Error("Read transaction aborted");db.close();reject(error)};
  }));
}

export function save(store,value){
  return openDB().then(db=>new Promise((resolve,reject)=>{
    const tx=db.transaction(store,"readwrite");
    tx.objectStore(store).put(value);
    tx.oncomplete=()=>{db.close();resolve()};
    tx.onerror=()=>{db.close();reject(tx.error)};
  }));
}

export function saveMany(store,values){
  if(!values||!values.length)return Promise.resolve();
  return openDB().then(db=>new Promise((resolve,reject)=>{
    const tx=db.transaction(store,"readwrite");
    const objectStore=tx.objectStore(store);
    values.forEach(value=>objectStore.put(value));
    tx.oncomplete=()=>{db.close();resolve()};
    tx.onerror=()=>{db.close();reject(tx.error)};
  }));
}

export function del(store,id){
  return openDB().then(db=>new Promise((resolve,reject)=>{
    const tx=db.transaction(store,"readwrite");
    tx.objectStore(store).delete(id);
    tx.oncomplete=()=>{db.close();resolve()};
    tx.onerror=()=>{db.close();reject(tx.error)};
  }));
}

export function clear(store){
  return openDB().then(db=>new Promise((resolve,reject)=>{
    const tx=db.transaction(store,"readwrite");
    tx.objectStore(store).clear();
    tx.oncomplete=()=>{db.close();resolve()};
    tx.onerror=()=>{db.close();reject(tx.error)};
  }));
}
