import { expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
const source = await readFile('public/theme-init.js','utf8');
function boot(choice: string | null, light: boolean, blocked=false) {
  const dataset: Record<string,string>={},meta={content:''};let writes=0;
  runInNewContext(source,{document:{documentElement:{dataset},querySelector:()=>meta},window:{matchMedia:()=>({matches:light})},localStorage:{getItem:()=>{if(blocked)throw Error('blocked');return choice},setItem:()=>writes++}});
  return {theme:dataset.theme,meta:meta.content,writes};
}
test('early appearance follows system without writing and honours only valid explicit choices',()=>{
  expect(boot(null,true)).toEqual({theme:'light',meta:'#F4F5EF',writes:0});
  expect(boot(null,false).theme).toBe('dark');
  expect(boot('dark',true).theme).toBe('dark');
  expect(boot('light',false).theme).toBe('light');
  expect(boot('invalid',true).theme).toBe('light');
  expect(boot(null,true,true).theme).toBe('light');
});
