export const BACKUP_VERSION=6;
export const MIN_SUPPORTED_BACKUP_VERSION=4;
export const MAX_IMPORT_BYTES=8*1024*1024;

const COMMON_STORES=["tasks","projects","notes","habits","activity","templates"];
const CURRENT_STORES=[...COMMON_STORES,"goals"];

function isRecord(value){
  return !!value&&typeof value==="object"&&!Array.isArray(value);
}

export function validateBackupPayload(payload,byteSize=0){
  if(byteSize>MAX_IMPORT_BYTES){
    return {ok:false,error:"Backup is larger than the 8 MB import safety limit."};
  }
  if(!isRecord(payload)){
    return {ok:false,error:"Backup must be a JSON object."};
  }
  const version=Number(payload.version);
  if(!Number.isInteger(version)){
    return {ok:false,error:"Backup version is missing or invalid."};
  }
  if(version<MIN_SUPPORTED_BACKUP_VERSION){
    return {ok:false,error:"This backup is too old for automatic restore. Export it from a newer Command Center first."};
  }
  if(version>BACKUP_VERSION){
    return {ok:false,error:"This backup was created by a newer Command Center version."};
  }

  const required=version===4?COMMON_STORES:CURRENT_STORES;
  for(const store of required){
    if(!Array.isArray(payload[store])){
      return {ok:false,error:"Backup is incomplete: "+store+" is missing or invalid."};
    }
    if(!payload[store].every(isRecord)){
      return {ok:false,error:"Backup is invalid: "+store+" contains malformed records."};
    }
  }

  const data={};
  for(const store of CURRENT_STORES){
    data[store]=Array.isArray(payload[store])?payload[store]:[];
  }
  return {ok:true,version,data};
}
