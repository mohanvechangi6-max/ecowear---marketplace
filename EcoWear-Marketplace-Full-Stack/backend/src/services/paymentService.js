import crypto from "node:crypto";

const demoPaymentProvider=async(order)=>({
 status:"succeeded",
 provider:"demo",
 transactionId:`DEMO-${crypto.randomUUID()}`,
 amount:order.total
});

const providers=new Map([["demo",demoPaymentProvider]]);

export function registerPaymentProvider(name,createPaymentIntent){
 if(typeof name!=="string"||!name.trim()||typeof createPaymentIntent!=="function") throw new TypeError("A payment provider name and function are required");
 providers.set(name.trim(),createPaymentIntent);
}

export async function createPayment(order){
 const providerName=process.env.PAYMENT_PROVIDER||"demo";
 const createPaymentIntent=providers.get(providerName);
 if(!createPaymentIntent) throw new Error(`Payment provider '${providerName}' is not registered`);
 const payment=await createPaymentIntent(order);
 if(!payment||payment.status!=="succeeded"||typeof payment.transactionId!=="string"||!payment.transactionId||typeof payment.amount!=="number"||!Number.isFinite(payment.amount)||payment.amount!==order.total){
  throw new Error(`Payment provider '${providerName}' returned an invalid successful payment`);
 }
 return {...payment,provider:providerName};
}
