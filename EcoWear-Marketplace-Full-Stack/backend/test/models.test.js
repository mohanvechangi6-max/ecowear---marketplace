import test from "node:test";
import assert from "node:assert/strict";
import User from "../src/models/User.js";
import Listing from "../src/models/Listing.js";
import Auction from "../src/models/Auction.js";
import Bid from "../src/models/Bid.js";
import Order from "../src/models/Order.js";

const userId="507f1f77bcf86cd799439011";
const listingId="507f1f77bcf86cd799439012";
const auctionId="507f1f77bcf86cd799439013";

test("user password is private by default and omitted from serialization",()=>{
 const user=new User({name:"Test User",email:"test@example.test",password:"hashed-password",role:"buyer"});
 assert.equal(User.schema.path("password").options.select,false);
 assert.equal(user.toJSON().password,undefined);
 assert.equal(user.toObject().password,undefined);
});

test("user rejects unsupported roles",async()=>{
 const user=new User({name:"Test User",email:"test@example.test",password:"hashed-password",role:"owner"});
 await assert.rejects(()=>user.validate(),(error)=>Boolean(error.errors.role));
});

test("listing enforces seller, valid condition, and nonnegative price",async()=>{
 const missingSeller=new Listing({title:"Garment",price:12});
 await assert.rejects(()=>missingSeller.validate(),(error)=>Boolean(error.errors.seller));
 const invalidCondition=new Listing({seller:userId,title:"Garment",condition:"broken",price:12});
 await assert.rejects(()=>invalidCondition.validate(),(error)=>Boolean(error.errors.condition));
 const negativePrice=new Listing({seller:userId,title:"Garment",price:-1});
 await assert.rejects(()=>negativePrice.validate(),(error)=>Boolean(error.errors.price));
 const tooLongLocation=new Listing({seller:userId,title:"Garment",location:"x".repeat(121),price:12});
 await assert.rejects(()=>tooLongLocation.validate(),(error)=>Boolean(error.errors.location));
});

test("auction requires a positive starting/current bid and end time",async()=>{
 const auction=new Auction({listing:listingId,seller:userId,startingBid:0,currentBid:0});
 await assert.rejects(()=>auction.validate(),(error)=>Boolean(error.errors.startingBid&&error.errors.currentBid&&error.errors.endsAt));
 assert.ok(Auction.schema.indexes().some(([keys,options])=>keys.listing===1&&options.unique&&options.partialFilterExpression?.status==="active"));
});

test("bid amount must be positive",async()=>{
 const bid=new Bid({auction:auctionId,bidder:userId,amount:0});
 await assert.rejects(()=>bid.validate(),(error)=>Boolean(error.errors.amount));
});

test("order requires server-defined buyer, seller, and total fields",async()=>{
 const order=new Order({items:[]});
 await assert.rejects(()=>order.validate(),(error)=>Boolean(error.errors.buyer&&error.errors.seller&&error.errors.total));
});
