'use strict';
// Ignore quoted import-looking samples in the verifier and comments; preserve
// executable static, dynamic-literal and export-from module dependency checks.
function executablePositions(source) {
  const code = new Uint8Array(source.length);
  const stack = [{type:'code',braces:null}];
  for(let i=0;i<source.length;i++){
    const ch=source[i],next=source[i+1],state=stack[stack.length-1];
    if(state.type==='template'){
      if(ch==='\\'){i++;continue;}
      if(ch==='`'){stack.pop();continue;}
      if(ch==='$'&&next==='{'){i++;stack.push({type:'code',braces:1});}
      continue;
    }
    if(ch==='/'&&next==='/'){
      i+=2;while(i<source.length&&source[i]!=='\n'&&source[i]!=='\r')i++;
      continue;
    }
    if(ch==='/'&&next==='*'){
      i+=2;while(i<source.length&&!(source[i]==='*'&&source[i+1]==='/'))i++;
      i++;continue;
    }
    if(ch==='"'||ch==="'"){
      const quote=ch;
      for(i++;i<source.length;i++){
        if(source[i]==='\\'){i++;continue;}
        if(source[i]===quote)break;
      }
      continue;
    }
    if(ch==='`'){stack.push({type:'template'});continue;}
    if(state.braces!==null){
      if(ch==='{')state.braces++;
      else if(ch==='}'&&--state.braces===0){stack.pop();continue;}
    }
    code[i]=1;
  }
  return code;
}
function importSpecs(source){
  const code=executablePositions(source),specs=new Set();
  for(const m of source.matchAll(/\bfrom\s*['"]([^'"]+)['"]|\bimport\s*(?:\(\s*)?['"]([^'"]+)['"]/g)){
    if(!code[m.index])continue;
    const spec=m[1]||m[2];
    if(!spec||/^(?:[a-z]+:|\/\/|data:)/i.test(spec)||(!spec.startsWith('.')&&!spec.startsWith('/')))continue;
    specs.add(spec);
  }
  return [...specs];
}
module.exports={importSpecs};
