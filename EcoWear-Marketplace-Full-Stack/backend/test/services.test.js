import test from "node:test";
import assert from "node:assert/strict";
import {gradeListing,registerAIGrader} from "../src/services/aiGrader.js";
import {createPayment,registerPaymentProvider} from "../src/services/paymentService.js";

test("demo AI grader produces stable scores and labels",async()=>{
 const grade=await gradeListing({condition:"good",brand:"Eco"});
 assert.equal(grade.conditionScore,76);
 assert.equal(grade.authenticityScore,85);
 assert.equal(grade.authenticityLabel,"Likely authentic");
 assert.match(grade.notes,/demo/i);
});

test("AI grader can be replaced using the registered provider",async()=>{
 const previous=process.env.AI_GRADER_PROVIDER;
 registerAIGrader("test-grader",async(listing)=>({conditionScore:91,authenticityScore:88,title:listing.title}));
 process.env.AI_GRADER_PROVIDER="test-grader";
 try{
  assert.deepEqual(await gradeListing({title:"Test garment"}),{conditionScore:91,authenticityScore:88,title:"Test garment"});
 }finally{
  if(previous===undefined) delete process.env.AI_GRADER_PROVIDER;
  else process.env.AI_GRADER_PROVIDER=previous;
 }
});

test("unknown AI graders fail explicitly",async()=>{
 const previous=process.env.AI_GRADER_PROVIDER;
 process.env.AI_GRADER_PROVIDER="not-registered";
 try{
  await assert.rejects(()=>gradeListing({}),/not registered/);
 }finally{
  if(previous===undefined) delete process.env.AI_GRADER_PROVIDER;
  else process.env.AI_GRADER_PROVIDER=previous;
 }
});

test("demo payment returns its provider, transaction ID, and order total",async()=>{
 const previous=process.env.PAYMENT_PROVIDER;
 delete process.env.PAYMENT_PROVIDER;
 try{
  const payment=await createPayment({total:425});
  assert.equal(payment.provider,"demo");
  assert.equal(payment.status,"succeeded");
  assert.equal(payment.amount,425);
  assert.match(payment.transactionId,/^DEMO-/);
 }finally{
  if(previous!==undefined) process.env.PAYMENT_PROVIDER=previous;
 }
});

test("payment adapter is validated against successful exact-amount payment",async()=>{
 const previous=process.env.PAYMENT_PROVIDER;
 registerPaymentProvider("test-payment",async(order)=>({
  status:"succeeded",
  transactionId:"test-transaction",
  amount:50
 }));
 process.env.PAYMENT_PROVIDER="test-payment";
 try{
  assert.deepEqual(await createPayment({total:50}),{
   status:"succeeded",
   transactionId:"test-transaction",
   amount:50,
   provider:"test-payment"
  });
  await assert.rejects(()=>createPayment({total:51}),/invalid successful payment/);
 }finally{
  if(previous===undefined) delete process.env.PAYMENT_PROVIDER;
  else process.env.PAYMENT_PROVIDER=previous;
 }
});

test("unknown payment providers fail explicitly",async()=>{
 const previous=process.env.PAYMENT_PROVIDER;
 process.env.PAYMENT_PROVIDER="not-registered";
 try{
  await assert.rejects(()=>createPayment({total:1}),/not registered/);
 }finally{
  if(previous===undefined) delete process.env.PAYMENT_PROVIDER;
  else process.env.PAYMENT_PROVIDER=previous;
 }
});
