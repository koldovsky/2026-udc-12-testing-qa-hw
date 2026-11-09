import test from 'node:test';
import assert from 'node:assert/strict';
import { quote, discount, QuoteError } from '../../src/tariff.js';
import { createDayCap, dayKey } from '../../src/day-cap.js';
import { formatReceipt, formatUah } from '../../src/receipt.js';

// Literal expectations: docs/test-cases.md; oracle: docs/spec/tariffs.md.
const pickup = '2026-09-16T07:00:00Z';
const ride = (seconds, extra = {}, from = pickup) => ({ pickupAt: from,
  returnAt: new Date(Date.parse(from) + seconds * 1000).toISOString(),
  bike: 'classic', returnStation: 'S01', ...extra });
const standard = { type: 'standard' };
const subscriber = { type: 'subscriber' };
const concession = { type: 'subscriber', concession: true };
const reduced = { type: 'reduced' };
const cases = [
  ['TC-01','T1',1801,{},standard,{minutes:31,timeCharge:5000,total:5000}],
  ['TC-02','T1',760,{},standard,{minutes:13,total:2500}],
  ['TC-04','T2',119,{},standard,{minutes:2,total:0}],
  ['TC-05','T2',120,{},standard,{minutes:2,total:0}],
  ['TC-06','T2',121,{},standard,{minutes:3,total:2500}],
  ['TC-07','T2/T7',50,{returnStation:'X01'},standard,{timeCharge:0,fees:[{code:'out-of-zone',amount:15000}],total:15000}],
  ['TC-08','T3',1740,{},standard,{total:2500}],
  ['TC-09','T3',1800,{},standard,{total:2500}],
  ['TC-10','T3',1860,{},standard,{total:5000}],
  ['TC-11','T3',4500,{bike:'ebike'},standard,{total:12000}],
  ['TC-12','T4',2640,{},subscriber,{total:0}],
  ['TC-13','T4',2700,{},subscriber,{total:0}],
  ['TC-14','T4',2760,{},subscriber,{total:2500}],
  ['TC-15','T4',6000,{},subscriber,{total:5000}],
  ['TC-16','T4',2400,{bike:'ebike'},subscriber,{timeCharge:8000,discounts:[{code:'subscription',amount:1600}],total:6400}],
  ['TC-17','T4',120,{bike:'ebike'},subscriber,{total:0}],
  ['TC-18','T5',2400,{},reduced,{timeCharge:5000,discounts:[{code:'reduced',amount:2500}],total:2500}],
  ['TC-19','T5',4800,{},concession,{discounts:[{code:'reduced',amount:3750}],total:3750}],
  ['TC-20','T5',3000,{},concession,{discounts:[{code:'subscription',amount:2500}],total:2500}],
  ['TC-21','T5',2400,{},concession,{discounts:[{code:'subscription',amount:5000}],total:0}],
  ['TC-22','T5/T7',2400,{returnStation:'X01'},reduced,{fees:[{code:'out-of-zone',amount:15000}],total:17500}],
  ['TC-23','T5/T8',90000,{},reduced,{fees:[{code:'unreturned',amount:200000}],total:230000}],
  ['TC-31','T8',86400,{},standard,{fees:[],total:30000}],
  ['TC-32','T8',86460,{},standard,{fees:[{code:'unreturned',amount:200000}],total:230000}],
  ['TC-33','T7/T8',90000,{returnStation:'X03'},standard,{fees:[{code:'out-of-zone',amount:15000},{code:'unreturned',amount:200000}],total:245000}],
];
for (const [id, rule, seconds, overrides, rider, expected] of cases) {
  test(`${rule}: ${id}`, () => {
    const result = quote(ride(seconds,overrides),rider);
    for (const [field,value] of Object.entries(expected)) assert.deepEqual(result[field],value,field);
  });
}
test('T1: TC-03 elapsed duration across DST', () => {
  const result = quote({pickupAt:'2026-10-25T02:30:00+03:00',returnAt:'2026-10-25T04:30:00+02:00',bike:'classic',returnStation:'S01'},standard);
  assert.equal(result.minutes,180);
  assert.equal(result.timeCharge,15000);
});
test('T6: TC-24 daily ledger sequence', () => {
  const dayCap=createDayCap(); const rider={type:'standard',id:'r1'};
  const totals=['06:00','10:00','15:00'].map(t=>quote(ride(4800,{bike:'ebike'},`2026-09-16T${t}:00Z`),rider,{dayCap}).total);
  assert.deepEqual(totals,[12000,12000,6000]);
  assert.equal(dayCap.chargedOn('r1','2026-09-16'),30000);
});
test('T6: TC-25 crossing midnight belongs to pickup day', () => {
  const dayCap=createDayCap(); dayCap.record('r1',pickup,29000);
  const from='2026-09-16T20:40:00Z';
  assert.equal(dayKey(from),'2026-09-16');
  const result=quote(ride(2400,{},from),{type:'standard',id:'r1'},{dayCap});
  const net=result.timeCharge-result.discounts.reduce((sum,d)=>sum+d.amount,0);
  assert.equal(dayCap.chargedOn('r1','2026-09-16'),29000+net);
  assert.equal(dayCap.chargedOn('r1','2026-09-17'),0);
});
test('T6: TC-26 Kyiv date resets before UTC midnight', () => {
  const dayCap=createDayCap(); dayCap.record('r1','2026-09-16T20:00:00Z',29000);
  const from='2026-09-16T21:10:00Z';
  assert.equal(dayKey(from),'2026-09-17');
  assert.equal(dayCap.remaining('r1',from),30000);
  assert.equal(quote(ride(1200,{},from),standard).timeCharge,2500);
});
test('T6: TC-27 different riders have independent caps', () => {
  const dayCap=createDayCap(); dayCap.record('r1',pickup,30000);
  assert.equal(quote(ride(1200),{type:'standard',id:'r2'},{dayCap}).total,2500);
  assert.equal(dayCap.chargedOn('r1','2026-09-16'),30000);
  assert.equal(dayCap.chargedOn('r2','2026-09-16'),2500);
});
test('T6/T7: TC-28 fees survive exhausted cap', () => {
  const dayCap=createDayCap();dayCap.record('r1',pickup,30000);
  const result=quote(ride(1200,{returnStation:'X02'}),{type:'standard',id:'r1'},{dayCap});
  assert.equal(result.total,15000);
  assert.deepEqual(result.fees,[{code:'out-of-zone',amount:15000}]);
});
for (const station of ['X01','X02','X03','S01','S02','S03','S04','S05','S06','S07','S08']) {
  const out=station.startsWith('X');
  test(`T7: ${out?'TC-29':'TC-30'} ${station}`,()=>{
    const result=quote(ride(1200,{returnStation:station}),standard);
    assert.equal(result.total,out?17500:2500);
    assert.deepEqual(result.fees,out?[{code:'out-of-zone',amount:15000}]:[]);
  });
}
test('T9: TC-34 fractional kopeck rounds payable down',()=>{
  assert.equal(discount(1235,30),371);
  assert.equal(1235-discount(1235,30),864);
});
for (const [amount,expected] of [[230000,'2 300,00 грн'],[-1250,'-12,50 грн'],[0,'0,00 грн']]) {
  test(`T9: TC-35 ${amount}`,()=>assert.equal(formatUah(amount),expected));
}
test('T9: TC-36 receipt itemization and signs',()=>{
  const lines=formatReceipt({minutes:1500,timeCharge:125000,discounts:[{code:'day-cap',amount:95000}],fees:[{code:'out-of-zone',amount:15000},{code:'unreturned',amount:200000}],total:245000});
  assert.equal(lines.length,6);
  for (const [i,label,amount] of [[1,'Погодинне нарахування','1 250,00 грн'],[2,'Денний ліміт','-950,00 грн'],[3,'Збір: повернення поза зоною','150,00 грн'],[4,'Збір: неповернений велосипед','2 000,00 грн'],[5,'До сплати','2 450,00 грн']]) {
    assert.ok(lines[i].startsWith(label));assert.ok(lines[i].endsWith(amount));
  }
  assert.equal(lines[0],'Тривалість поїздки: 1500 хв');
});
for (const [id,from,total,discounts] of [
  ['TC-37','2026-09-15T22:10:00Z',1750,[{code:'night',amount:750}]],
  ['TC-38','2026-09-15T21:00:00Z',1750,[{code:'night',amount:750}]],
  ['TC-39','2026-09-16T03:00:00Z',2500,[]],
]) test(`T10: ${id}`,()=>{
  const result=quote(ride(1800,{},from),standard);
  assert.equal(result.timeCharge,2500);assert.equal(result.total,total);assert.deepEqual(result.discounts,discounts);
});
for (const [id,overrides,rider] of [
  ['TC-40',{returnAt:'2026-09-16T06:59:59Z'},standard],
  ['TC-41',{bike:'cargo'},standard],
  ['TC-42',{}, {type:'visitor'}],
  ['TC-43',{returnStation:'S99'},standard],
]) test(`Validation: ${id}`,()=>assert.throws(()=>quote(ride(1200,overrides),rider),e=>e instanceof QuoteError && e.message.length>0));
