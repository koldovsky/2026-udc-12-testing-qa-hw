import test from 'node:test';
import assert from 'node:assert/strict';
import {quote,discount,QuoteError} from '../../app/src/tariff.js';
import {createDayCap,dayKey} from '../../app/src/day-cap.js';
const rider={type:'standard'};
const ride=(seconds,extra={})=>({pickupAt:'2026-09-16T07:00:00Z',returnAt:new Date(Date.parse('2026-09-16T07:00:00Z')+seconds*1000).toISOString(),bike:'classic',returnStation:'S01',...extra});
for(const [name,seconds,extra,r,expected] of [
 ['rounds 30m20s to 30',1820,{},rider,2500],
 ['two minutes costs a block',120,{},rider,2500],
 ['standard fifty minutes',3000,{},rider,5000],
 ['classic subscriber forty minutes',2400,{}, {type:'subscriber'},0],
 ['electric subscriber forty minutes free',2400,{bike:'ebike'},{type:'subscriber'},0],
 ['reduced rider discounts outside fee',2400,{returnStation:'X01'},{type:'reduced'},10000],
 ['subscriber concession picks cheaper plan',4800,{}, {type:'subscriber',concession:true},3750],
 ['outside zone',1200,{returnStation:'X01'},rider,17500],
 ['over day both fees',90000,{returnStation:'X03'},rider,245000],
]) test(name,()=>assert.equal(quote(ride(seconds,extra),r).total,expected));
test('ledger uses UTC pickup date',()=>assert.equal(dayKey('2026-09-16T21:10:00Z'),'2026-09-16'));
test('ledger accumulates and clamps remaining',()=>{
 const ledger=createDayCap();ledger.record('r1','2026-09-16T07:00:00Z',12000);
 assert.equal(ledger.remaining('r1','2026-09-16T12:00:00Z'),18000);
 ledger.record('r1','2026-09-16T12:00:00Z',20000);
 assert.equal(ledger.remaining('r1','2026-09-16T14:00:00Z'),0);
 assert.equal(ledger.remaining('r2','2026-09-16T14:00:00Z'),30000);
});
test('discount rounds payable down',()=>assert.equal(discount(1235,30),371));
test('invalid station rejected',()=>assert.throws(()=>quote(ride(1200,{returnStation:'S99'}),rider),QuoteError));
