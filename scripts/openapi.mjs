// Read literal Express routes using the TypeScript AST so removed handlers disappear.
import ts from 'typescript';
import { readFileSync, writeFileSync } from 'node:fs';
const file=new URL('../apps/bff/src/app.ts',import.meta.url);
const source=ts.createSourceFile('app.ts',readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);
const paths={};
function visit(node) {
  if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
    const call=node.expression, method=call.name.text, path=node.arguments[0];
    if (call.expression.getText(source)==='app' && ['get','post','delete','put','patch'].includes(method) && path && ts.isStringLiteral(path)) {
      const route=path.text.replace(/:(\w+)/g,'{$1}');
      const parameters=[...route.matchAll(/\{(\w+)\}/g)].map(([,name])=>({name,in:'path',required:true,schema:{type:'string'}}));
      const responses={'2XX':{description:'Successful response; see API reference for the payload'},default:{description:'Request or upstream error'}};
      (paths[route]??={})[method]={operationId:method+'_'+route.replace(/\W+/g,'_').replace(/^_|_$/g,''),parameters,responses};
    }
  }
  ts.forEachChild(node,visit);
}
visit(source);
writeFileSync(new URL('../submission/openapi.json',import.meta.url),JSON.stringify({openapi:'3.1.0',info:{title:'Inji Playground BFF',version:'0.1.0',description:'Generated route inventory. Request formats and response examples are in the API reference.'},externalDocs:{url:'https://github.com/oki-dokii/mosip/blob/main/submission/API_REFERENCE.md'},paths},null,2)+'\n');
