import type{Pool}from"pg";import{processLabAlerts}from"@nexosophy/db";
type D={pool:Pool;logger:{info:(x:any,m?:string)=>void;warn:(x:any,m?:string)=>void};stopping:()=>boolean;delay:(ms:number)=>Promise<void>};
export async function runLabAlertLoop(d:D){while(!d.stopping()){try{const r=await processLabAlerts(d.pool,200);if(r.emitted)d.logger.info(r,"Lab alerts emitted");await d.delay(r.emitted?5000:60000)}catch(e){d.logger.warn({err:e},"Lab alert scan failed");await d.delay(60000)}}}
