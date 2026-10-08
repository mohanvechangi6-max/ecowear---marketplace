import express from "express";
import mongoose from "mongoose";
import {auth,roles,optionalAuth} from "../middleware/auth.js";
import Listing from "../models/Listing.js";
import Order from "../models/Order.js";
import RepairService from "../models/RepairService.js";
import RepairBooking from "../models/RepairBooking.js";
import Review from "../models/Review.js";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import Auction from "../models/Auction.js";
import Bid from "../models/Bid.js";
import AIGrade from "../models/AIGrade.js";
import Report from "../models/Report.js";
import User from "../models/User.js";
import {gradeListing} from "../services/aiGrader.js";
import {createPayment} from "../services/paymentService.js";

const r=express.Router();
const oid=(v)=>v;
const demoImpact=(price=0)=>({waterSaved:Math.round(2700+price*2),co2Saved:+(8+price/100).toFixed(2),score:Math.round(50+Math.min(price,500)/10),estimated:true});
const listingStatuses=["draft","active","sold","paused","rejected"];
const sellerListingStatuses=["draft","active","paused"];
const listingFields=["title","description","category","brand","location","size","color","material","condition","price","images"];
const searchFields=["title","description","category","brand","location","size","color","material"];
const listingConditions=["new","excellent","good","fair","poor"];

function validId(value){
 return typeof value==="string"&&mongoose.isObjectIdOrHexString(value);
}

function hasOnlyKeys(body,allowedKeys){
 return body&&typeof body==="object"&&!Array.isArray(body)&&Object.keys(body).every((key)=>allowedKeys.includes(key));
}

function isEmptyBody(body){
 return body===undefined||body===null||(typeof body==="object"&&!Array.isArray(body)&&Object.keys(body).length===0);
}

function isValidImpact(impact){
 return impact&&Number.isFinite(impact.waterSaved)&&impact.waterSaved>=0&&
  Number.isFinite(impact.co2Saved)&&impact.co2Saved>=0&&
  Number.isFinite(impact.score)&&impact.score>=0&&impact.score<=100;
}

function listingImpact(listing){
 const impact=listing.impact;
 if(isValidImpact(impact)){
  return {
   waterSaved:Math.round(impact.waterSaved),
   co2Saved:Number(impact.co2Saved.toFixed(2)),
   score:Math.round(impact.score),
   estimated:true
  };
 }
 return demoImpact(Number(listing.price)||0);
}

function orderImpact(order){
 return order.items.reduce((total,item)=>{
  const hasStoredImpact=isValidImpact(item.impact);
  const impact=hasStoredImpact?item.impact:demoImpact(Number(item.price)||0);
  const quantity=Number(item.quantity)||1;
  total.waterSaved+=impact.waterSaved*quantity;
  total.co2Saved+=impact.co2Saved*quantity;
  total.score+=impact.score*quantity;
  total.estimated=true;
  return total;
 },{waterSaved:0,co2Saved:0,score:0,estimated:false});
}

function formatImpact(impact){
 return {
  waterSaved:Math.round(impact.waterSaved),
  co2Saved:Number(impact.co2Saved.toFixed(2)),
  score:Math.round(impact.score),
  estimated:Boolean(impact.estimated)
 };
}

function listingInput(body,{create=false}={}){
 if(!body||typeof body!=="object"||Array.isArray(body)) return {error:"A JSON object is required"};
 const allowed=new Set(listingFields);
 const input={};
 for(const [key,value] of Object.entries(body)){
  if(!allowed.has(key)) return {error:`Field '${key}' cannot be set`};
  input[key]=value;
 }
 if(create&&(!("title" in input)||!("price" in input))) return {error:"title and price are required"};
 if("title" in input&&typeof input.title!=="string") return {error:"title must be a string"};
 if("title" in input&&!input.title.trim()) return {error:"title cannot be empty"};
 for(const key of ["description","category","brand","location","size","color","material"]){
  if(key in input&&typeof input[key]!=="string") return {error:`${key} must be a string`};
  if(key in input) input[key]=input[key].trim();
 }
 if("location" in input&&input.location.length>120) return {error:"location must be at most 120 characters"};
 if("condition" in input&&!["new","excellent","good","fair","poor"].includes(input.condition)) return {error:"Invalid condition"};
 if("price" in input&&(typeof input.price!=="number"||!Number.isFinite(input.price)||input.price<0)) return {error:"price must be a non-negative number"};
 if("images" in input&&(!Array.isArray(input.images)||input.images.some((image)=>typeof image!=="string"))) return {error:"images must be an array of strings"};
 return {input};
}

function listingOwnerFilter(user,id){
 return user.role==="admin"?{_id:id}:{_id:id,seller:user._id};
}

const orderStatuses=["pending","paid","processing","shipped","delivered","cancelled"];
const orderTransitions={
 pending:[],
 paid:["processing"],
 processing:["shipped"],
 shipped:["delivered"],
 delivered:[],
 cancelled:[]
};

function orderAccessQuery(user){
 if(user.role==="admin") return {};
 if(user.role==="buyer") return {buyer:user._id};
 if(user.role==="seller") return {seller:user._id};
 return null;
}

function orderStatusAllowed(user,order,status){
 if(!orderStatuses.includes(status)||!orderTransitions[order.status]?.includes(status)) return false;
 if(user.role==="admin") return true;
 if(user.role==="seller"&&order.seller.toString()===user._id.toString()) return ["processing","shipped","delivered"].includes(status);
 return false;
}

async function closeExpiredAuction(auction){
 if(auction.status!=="active"||auction.endsAt>new Date()) return auction;
 const closed=await Auction.findOneAndUpdate(
  {_id:auction._id,status:"active",endsAt:{$lte:new Date()}},
  {status:"closed",winner:auction.currentBidder||null},
  {new:true}
 );
 if(closed&&!closed.winner){
  await Listing.findOneAndUpdate(
   {_id:closed.listing,isAuction:true,status:"paused"},
   {status:"active",isAuction:false}
  );
 }
 return closed||Auction.findById(auction._id);
}

function validShippingAddress(address){
 return address&&typeof address==="object"&&!Array.isArray(address)&&
  Object.keys(address).every((key)=>["name","line1","city","postalCode","country"].includes(key))&&
  typeof address.name==="string"&&address.name.trim().length>0&&address.name.trim().length<=100&&
  typeof address.line1==="string"&&address.line1.trim().length>0&&address.line1.trim().length<=250&&
  typeof address.city==="string"&&address.city.trim().length>0&&address.city.trim().length<=100&&
  typeof address.postalCode==="string"&&address.postalCode.trim().length>0&&address.postalCode.trim().length<=32&&
  typeof address.country==="string"&&address.country.trim().length>0&&address.country.trim().length<=100;
}

const repairBookingTransitions={
 requested:["confirmed","cancelled"],
 confirmed:["in_progress","cancelled"],
 in_progress:["completed"],
 completed:[],
 cancelled:[]
};

async function findConversationForUser(conversationId,userId){
 if(!validId(conversationId)) throw Object.assign(new Error("Invalid conversation ID"),{status:400});
 const conversation=await Conversation.findOne({_id:conversationId,participants:userId});
 if(!conversation) throw Object.assign(new Error("Conversation not found"),{status:404});
 return conversation;
}

function reviewInput(body){
 if(!body||typeof body!=="object"||Array.isArray(body)) return {error:"A JSON object is required"};
 for(const key of Object.keys(body)){
  if(!["listing","rating","comment"].includes(key)) return {error:`Field '${key}' cannot be set`};
 }
 if(!Number.isInteger(body.rating)||body.rating<1||body.rating>5) return {error:"rating must be an integer from 1 to 5"};
 if(typeof body.comment!=="string"||!body.comment.trim()||body.comment.trim().length>2000) return {error:"comment is required and must be at most 2000 characters"};
 return {input:{rating:body.rating,comment:body.comment.trim()}};
}

function validateRepairServiceInput(body){
 const fields=["name","description","category","price","durationMinutes","location"];
 if(!body||typeof body!=="object"||Array.isArray(body)) return {error:"A JSON object is required"};
 for(const key of Object.keys(body)){
  if(!fields.includes(key)) return {error:`Field '${key}' cannot be set`};
 }
 for(const key of ["name","description","category","location"]){
  if(typeof body[key]!=="string"||!body[key].trim()) return {error:`${key} is required`};
 }
 if(typeof body.price!=="number"||!Number.isFinite(body.price)||body.price<0) return {error:"price must be a non-negative number"};
 if(!Number.isInteger(body.durationMinutes)||body.durationMinutes<1) return {error:"durationMinutes must be a positive integer"};
 return {input:{
  name:body.name.trim(),
  description:body.description.trim(),
  category:body.category.trim(),
  location:body.location.trim(),
  price:body.price,
  durationMinutes:body.durationMinutes
 }};
}

const reportTargets={
 listing:Listing,
 user:User,
 review:Review,
 message:Message,
 conversation:Conversation
};

function escapeRegex(value){
 return value.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
}

function searchInput(query){
 const allowed=["q","category","brand","location","size","color","material","condition","sort","minPrice","maxPrice"];
 for(const key of Object.keys(query)) if(!allowed.includes(key)) return {error:`Unsupported search filter '${key}'`};
 const stringParams=["q","category","brand","location","size","color","material","condition","sort"];
 for(const key of stringParams){
  if(query[key]!==undefined&&typeof query[key]!=="string") return {error:`${key} must be a single string`};
 }
 if(query.location?.length>120) return {error:"location must be at most 120 characters"};
 for(const key of ["minPrice","maxPrice"]){
  if(query[key]!==undefined&&typeof query[key]!=="string") return {error:`${key} must be a single number`};
 }
 if(query.condition!==undefined&&!listingConditions.includes(query.condition)) return {error:"Invalid condition"};
 const filter={status:"active"};
 for(const key of ["category","brand","location","size","color","material","condition"]){
  if(query[key]) filter[key]=query[key].trim();
 }
 if(query.q?.trim()){
  const expression=new RegExp(escapeRegex(query.q.trim()),"i");
  filter.$or=searchFields.map((field)=>({[field]:expression}));
 }
 const hasMin=query.minPrice!==undefined,hasMax=query.maxPrice!==undefined;
 const min=hasMin?Number(query.minPrice):0,max=hasMax?Number(query.maxPrice):Number.MAX_SAFE_INTEGER;
 if((hasMin&&!Number.isFinite(min))||(hasMax&&!Number.isFinite(max))||min<0||max<min) return {error:"Invalid price range"};
 if(hasMin||hasMax) filter.price={$gte:min,$lte:max};
 const sortOptions={"newest":"-createdAt","price_asc":"price","price_desc":"-price"};
 const sort=query.sort||"newest";
 if(!Object.prototype.hasOwnProperty.call(sortOptions,sort)) return {error:"Invalid sort order"};
 return {filter,sort:sortOptions[sort]};
}

async function findGradeListing(req,id,{manage=false}={}){
 if(!validId(id)) throw Object.assign(new Error("Invalid listing ID"),{status:400});
 const listing=await Listing.findById(id);
 if(!listing) throw Object.assign(new Error("Listing not found"),{status:404});
 const userId=(req.user?._id||req.user?.id)?.toString();
 let isAdmin=req.user?.role==="admin";
 if(userId&&!req.user?.role){
  const user=await User.findById(userId).select("role");
  isAdmin=user?.role==="admin";
 }
 const isOwner=userId===listing.seller.toString();
 if(manage&&!isOwner&&!isAdmin) throw Object.assign(new Error("Only the listing owner or an admin can grade this listing"),{status:403});
 if(!manage&&listing.status!=="active"&&!isOwner&&!isAdmin) throw Object.assign(new Error("Listing not found"),{status:404});
 return listing;
}

async function createGrade(listing){
 const result=await gradeListing(listing);
 const grade=await AIGrade.create({...result,listing:listing._id});
 listing.aiGrade=grade.toObject();
 await listing.save();
 return grade;
}

//
// 7 Listing APIs
//
r.post("/listings",auth,roles("seller","admin"),async(req,res,next)=>{
 try{
  const {input,error}=listingInput(req.body,{create:true});
  if(error) return res.status(400).json({message:error});
  const x=await Listing.create({...input,seller:req.user._id});
  res.status(201).json(x);
 }catch(e){next(e)}
});
r.get("/listings",optionalAuth,async(req,res,next)=>{
 try{
  if(Object.keys(req.query).some((key)=>!["category","brand","status","minPrice","maxPrice"].includes(key))) return res.status(400).json({message:"Unsupported listing filter"});
  const filter={};
  if(req.query.category) filter.category=String(req.query.category);
  if(req.query.brand) filter.brand=String(req.query.brand);
  if(req.query.status){
   if(!listingStatuses.includes(req.query.status)) return res.status(400).json({message:"Invalid listing status"});
   if(req.query.status==="active") filter.status="active";
   else if(req.user?.id) Object.assign(filter,{status:req.query.status,seller:req.user.id});
   else return res.status(403).json({message:"Authentication required to view non-active listings"});
  }else if(req.user?.id){
   filter.$or=[{status:"active"},{seller:req.user.id}];
  }else filter.status="active";
  const hasMin=req.query.minPrice!==undefined,hasMax=req.query.maxPrice!==undefined;
  const min=hasMin?Number(req.query.minPrice):0,max=hasMax?Number(req.query.maxPrice):Number.MAX_SAFE_INTEGER;
  if((hasMin&&!Number.isFinite(min))||(hasMax&&!Number.isFinite(max))||min<0||max<min) return res.status(400).json({message:"Invalid price range"});
  if(hasMin||hasMax) filter.price={$gte:min,$lte:max};
  const x=await Listing.find(filter).populate("seller","name role").sort("-createdAt");
  res.json(x);
 }catch(e){next(e)}
});
r.get("/listings/:id",optionalAuth,async(req,res,next)=>{
 try{
  if(!validId(req.params.id)) return res.status(400).json({message:"Invalid listing ID"});
  const x=await Listing.findById(req.params.id).populate("seller","name role");
  if(!x||(x.status!=="active"&&x.seller?._id.toString()!==req.user?.id)) return res.status(404).json({message:"Listing not found"});
  res.json(x);
 }catch(e){next(e)}
});
r.put("/listings/:id",auth,roles("seller","admin"),async(req,res,next)=>{
 try{
  if(!validId(req.params.id)) return res.status(400).json({message:"Invalid listing ID"});
  const {input,error}=listingInput(req.body);
  if(error) return res.status(400).json({message:error});
  if(!Object.keys(input).length) return res.status(400).json({message:"At least one listing field is required"});
  const x=await Listing.findOneAndUpdate(listingOwnerFilter(req.user,req.params.id),input,{new:true,runValidators:true});
  if(!x) return res.status(404).json({message:"Listing not found"});
  res.json(x);
 }catch(e){next(e)}
});
r.delete("/listings/:id",auth,roles("seller","admin"),async(req,res,next)=>{
 try{
  if(!validId(req.params.id)) return res.status(400).json({message:"Invalid listing ID"});
  if(!isEmptyBody(req.body)) return res.status(400).json({message:"Delete request body must be empty"});
  const x=await Listing.findOneAndDelete(listingOwnerFilter(req.user,req.params.id));
  if(!x) return res.status(404).json({message:"Listing not found"});
  res.json({message:"Listing deleted"});
 }catch(e){next(e)}
});
r.patch("/listings/:id/status",auth,roles("seller","admin"),async(req,res,next)=>{
 try{
  if(!validId(req.params.id)) return res.status(400).json({message:"Invalid listing ID"});
  const allowed=req.user.role==="admin"?listingStatuses:sellerListingStatuses;
  if(!hasOnlyKeys(req.body,["status"])||Object.keys(req.body).length!==1||!allowed.includes(req.body.status)) return res.status(400).json({message:"Invalid listing status"});
  const existing=await Listing.findOne(listingOwnerFilter(req.user,req.params.id));
  if(!existing) return res.status(404).json({message:"Listing not found"});
  if(existing.isAuction) return res.status(409).json({message:"Listings reserved for an auction cannot be changed through listing status"});
  const x=await Listing.findOneAndUpdate(listingOwnerFilter(req.user,req.params.id),{status:req.body.status},{new:true,runValidators:true});
  if(!x) return res.status(404).json({message:"Listing not found"});
  res.json(x);
 }catch(e){next(e)}
});
r.get("/sellers/:sellerId/listings",optionalAuth,async(req,res,next)=>{
 try{
  if(!validId(req.params.sellerId)) return res.status(400).json({message:"Invalid seller ID"});
  const filter={seller:req.params.sellerId};
  if(req.user?.id!==req.params.sellerId) filter.status="active";
  const x=await Listing.find(filter).populate("seller","name role").sort("-createdAt");
  res.json(x);
 }catch(e){next(e)}
});

//
// 5 AI APIs
//
r.post("/ai/grade/:listingId",auth,roles("seller","admin"),async(req,res,next)=>{
 try{
  if(!isEmptyBody(req.body)) return res.status(400).json({message:"Grade request body must be empty"});
  const listing=await findGradeListing(req,req.params.listingId,{manage:true});
  const latest=await AIGrade.findOne({listing:listing._id}).sort("-createdAt");
  if(latest) return res.json(latest);
  res.status(201).json(await createGrade(listing));
 }catch(e){next(e)}
});
r.get("/ai/grade/:listingId",optionalAuth,async(req,res,next)=>{
 try{
  const listing=await findGradeListing(req,req.params.listingId);
  const grade=await AIGrade.findOne({listing:listing._id}).sort("-createdAt");
  if(!grade) return res.status(404).json({message:"Grade not found"});
  res.json(grade);
 }catch(e){next(e)}
});
r.post("/ai/regrade/:listingId",auth,roles("seller","admin"),async(req,res,next)=>{
 try{
  if(!isEmptyBody(req.body)) return res.status(400).json({message:"Regrade request body must be empty"});
  const listing=await findGradeListing(req,req.params.listingId,{manage:true});
  res.status(201).json(await createGrade(listing));
 }catch(e){next(e)}
});
r.get("/ai/history/:listingId",optionalAuth,async(req,res,next)=>{
 try{
  const listing=await findGradeListing(req,req.params.listingId);
  res.json(await AIGrade.find({listing:listing._id}).sort("-createdAt"));
 }catch(e){next(e)}
});
r.post("/ai/verify-authenticity/:listingId",auth,roles("seller","admin"),async(req,res,next)=>{
 try{
  if(!isEmptyBody(req.body)) return res.status(400).json({message:"Verification request body must be empty"});
  const listing=await findGradeListing(req,req.params.listingId,{manage:true});
  const grade=await createGrade(listing);
  res.json({verified:grade.authenticityScore>=85,score:grade.authenticityScore,grade});
 }catch(e){next(e)}
});

//
// 5 Search APIs
//
r.get("/search",async(req,res,next)=>{
 try{
  const {filter,sort,error}=searchInput(req.query);
  if(error) return res.status(400).json({message:error});
  res.json(await Listing.find(filter).populate("seller","name role").sort(sort));
 }catch(e){next(e)}
});
r.get("/search/suggestions",async(req,res,next)=>{
 try{
  if(req.query.q!==undefined&&typeof req.query.q!=="string") return res.status(400).json({message:"q must be a single string"});
  const q=(req.query.q||"").trim();
  if(!q) return res.json([]);
  const expression=new RegExp(escapeRegex(q),"i");
  const matches=await Listing.find({status:"active",$or:searchFields.map((field)=>({[field]:expression}))})
   .select("title brand category")
   .sort("-createdAt")
   .limit(8);
  const seen=new Set();
  const suggestions=[];
  for(const item of matches){
   const key=item.title.toLowerCase();
   if(!seen.has(key)){
    seen.add(key);
    suggestions.push({title:item.title,brand:item.brand||"",category:item.category||""});
   }
  }
  res.json(suggestions);
 }catch(e){next(e)}
});
r.get("/categories",async(req,res,next)=>{
 try{
  const values=await Listing.distinct("category",{status:"active",category:{$type:"string",$ne:""}});
  res.json(values.sort((a,b)=>a.localeCompare(b)));
 }catch(e){next(e)}
});
r.get("/brands",async(req,res,next)=>{
 try{
  const values=await Listing.distinct("brand",{status:"active",brand:{$type:"string",$ne:""}});
  res.json(values.sort((a,b)=>a.localeCompare(b)));
 }catch(e){next(e)}
});
r.get("/filters",async(req,res,next)=>{
 try{
  const [categories,brands,locations,sizes,colors,materials,priceRange]=await Promise.all([
   Listing.distinct("category",{status:"active",category:{$type:"string",$ne:""}}),
   Listing.distinct("brand",{status:"active",brand:{$type:"string",$ne:""}}),
   Listing.distinct("location",{status:"active",location:{$type:"string",$ne:""}}),
   Listing.distinct("size",{status:"active",size:{$type:"string",$ne:""}}),
   Listing.distinct("color",{status:"active",color:{$type:"string",$ne:""}}),
   Listing.distinct("material",{status:"active",material:{$type:"string",$ne:""}}),
   Listing.aggregate([{ $match:{status:"active",price:{$type:"number"}} },{ $group:{_id:null,min:{ $min:"$price" },max:{ $max:"$price" }} }])
  ]);
  const alpha=(values)=>values.sort((a,b)=>a.localeCompare(b));
  res.json({
   categories:alpha(categories),
   brands:alpha(brands),
   locations:alpha(locations),
   sizes:alpha(sizes),
   colors:alpha(colors),
   materials:alpha(materials),
   conditions:listingConditions,
   price:{min:priceRange[0]?.min??0,max:priceRange[0]?.max??0}
  });
 }catch(e){next(e)}
});

//
// 7 Orders/payment
//
r.post("/orders",auth,roles("buyer"),async(req,res,next)=>{
 try{
  if(!hasOnlyKeys(req.body,["items","shippingAddress"])) return res.status(400).json({message:"Provide only items and shippingAddress"});
  const {items,shippingAddress}=req.body||{};
  if(!Array.isArray(items)||items.length===0||items.length>50) return res.status(400).json({message:"Provide between 1 and 50 order items"});
  if(!validShippingAddress(shippingAddress)) return res.status(400).json({message:"Shipping address requires name, line1, city, postalCode, and country"});
  const listingIds=new Set();
  const normalized=[];
  let sellerId=null,total=0;
  for(const item of items){
   if(!hasOnlyKeys(item,["listing","quantity"])||!validId(item.listing)) return res.status(400).json({message:"Each item requires a valid listing ID and optional quantity"});
   if(item.quantity!==undefined&&item.quantity!==1) return res.status(400).json({message:"Secondhand listings can only be ordered in quantity 1"});
   if(listingIds.has(item.listing)) return res.status(400).json({message:"A listing may only appear once in an order"});
   listingIds.add(item.listing);
   const listing=await Listing.findById(item.listing);
   if(!listing||listing.status!=="active") return res.status(400).json({message:"One or more listings are no longer available"});
   if(listing.isAuction) return res.status(409).json({message:"Auction listings cannot be purchased through regular checkout"});
   if(sellerId&&sellerId.toString()!==listing.seller.toString()) return res.status(400).json({message:"Place orders for items from one seller at a time"});
   sellerId=listing.seller;
   const price=Number(listing.price);
   if(!Number.isFinite(price)||price<0) return res.status(400).json({message:"Listing has an invalid price"});
   if(!Number.isFinite(total+price)) return res.status(400).json({message:"Order total exceeds the supported amount"});
   total+=price;
   normalized.push({listing:listing._id,price,quantity:1,impact:listingImpact(listing)});
  }
  const order=await Order.create({buyer:req.user._id,seller:sellerId,items:normalized,total,shippingAddress});
  res.status(201).json(order);
 }catch(e){next(e)}
});
r.get("/orders",auth,async(req,res,next)=>{
 try{
  const query=orderAccessQuery(req.user);
  if(!query) return res.status(403).json({message:"Forbidden"});
  res.json(await Order.find(query).populate("buyer","name").populate("seller","name").populate("items.listing","title images"));
 }catch(e){next(e)}
});
r.get("/orders/:id",auth,async(req,res,next)=>{
 try{
  if(!validId(req.params.id)) return res.status(400).json({message:"Invalid order ID"});
  const query=orderAccessQuery(req.user);
  if(!query) return res.status(403).json({message:"Forbidden"});
  const order=await Order.findOne({_id:req.params.id,...query}).populate("buyer","name").populate("seller","name").populate("items.listing");
  if(!order) return res.status(404).json({message:"Order not found"});
  res.json(order);
 }catch(e){next(e)}
});
r.patch("/orders/:id/status",auth,roles("seller","admin"),async(req,res,next)=>{
 try{
  if(!validId(req.params.id)) return res.status(400).json({message:"Invalid order ID"});
  if(!hasOnlyKeys(req.body,["status"])||Object.keys(req.body).length!==1||typeof req.body.status!=="string") return res.status(400).json({message:"A valid status is required"});
  const query=req.user.role==="admin"?{_id:req.params.id}:{_id:req.params.id,seller:req.user._id};
  const order=await Order.findOne(query);
  if(!order) return res.status(404).json({message:"Order not found"});
  if(!orderStatusAllowed(req.user,order,req.body.status)) return res.status(400).json({message:"Order status transition is not allowed"});
  order.status=req.body.status;
  await order.save();
  res.json(order);
 }catch(e){next(e)}
});
r.post("/orders/:id/payment",auth,roles("buyer"),async(req,res,next)=>{
 try{
  if(!validId(req.params.id)) return res.status(400).json({message:"Invalid order ID"});
  if(!isEmptyBody(req.body)) return res.status(400).json({message:"Payment request body must be empty"});
  const order=await Order.findOne({_id:req.params.id,buyer:req.user._id});
  if(!order) return res.status(404).json({message:"Order not found"});
  if(order.status!=="pending") return res.status(409).json({message:"Only pending orders can be paid"});
  const payment=await createPayment(order);
  const soldListings=[];
  for(const item of order.items){
   const sold=await Listing.findOneAndUpdate(
    {_id:item.listing,status:"active"},
    {status:"sold",soldOrder:order._id},
    {new:true}
   );
   if(!sold){
    await Promise.all(soldListings.map((listingId)=>Listing.findOneAndUpdate(
     {_id:listingId,status:"sold",soldOrder:order._id},
     {status:"active",$unset:{soldOrder:1}}
    )));
    return res.status(409).json({message:"One or more listings have already been sold"});
   }
   soldListings.push(item.listing);
  }
  const updatedOrder=await Order.findOneAndUpdate(
   {_id:order._id,buyer:req.user._id,status:"pending"},
   {status:"paid",payment:{status:payment.status,provider:payment.provider,transactionId:payment.transactionId}},
   {new:true}
  );
  if(!updatedOrder){
   await Promise.all(soldListings.map((listingId)=>Listing.findOneAndUpdate(
    {_id:listingId,status:"sold",soldOrder:order._id},
    {status:"active",$unset:{soldOrder:1}}
   )));
   return res.status(409).json({message:"Order is no longer pending"});
  }
  res.json({success:true,order:updatedOrder,payment:{provider:payment.provider,transactionId:payment.transactionId,amount:payment.amount}});
 }catch(e){next(e)}
});
r.post("/orders/:id/cancel",auth,async(req,res,next)=>{
 try{
  if(!validId(req.params.id)) return res.status(400).json({message:"Invalid order ID"});
  if(!isEmptyBody(req.body)) return res.status(400).json({message:"Cancellation request body must be empty"});
  const query=req.user.role==="admin"?{_id:req.params.id}:{_id:req.params.id,buyer:req.user._id};
  const order=await Order.findOne(query);
  if(!order) return res.status(404).json({message:"Order not found"});
  if(order.status!=="pending"&&!(req.user.role==="admin"&&["paid","processing"].includes(order.status))) return res.status(409).json({message:"This order can no longer be cancelled"});
  const wasPaid=["paid","processing"].includes(order.status);
  order.status="cancelled";
  if(!order.payment) order.payment={status:"not_required"};
  await order.save();
  if(wasPaid){
   await Promise.all(order.items.map(({listing})=>Listing.findOneAndUpdate(
    {_id:listing,status:"sold",soldOrder:order._id},
    {status:"active",$unset:{soldOrder:1}}
   )));
  }
  res.json(order);
 }catch(e){next(e)}
});
r.get("/orders/:id/invoice",auth,async(req,res,next)=>{
 try{
  if(!validId(req.params.id)) return res.status(400).json({message:"Invalid order ID"});
  const query=orderAccessQuery(req.user);
  if(!query) return res.status(403).json({message:"Forbidden"});
  const order=await Order.findOne({_id:req.params.id,...query}).populate("buyer","name").populate("seller","name").populate("items.listing","title brand condition images");
  if(!order) return res.status(404).json({message:"Order not found"});
  if(order.payment?.status!=="succeeded") return res.status(409).json({message:"Invoice is available after successful payment"});
  res.json({invoiceNumber:"EW-"+order._id.toString().slice(-8).toUpperCase(),issuedAt:order.updatedAt,order});
 }catch(e){next(e)}
});

//
// 6 Repair APIs
//
r.get("/repair-services",optionalAuth,async(req,res,next)=>{
 try{
  const filter=req.user?.role==="admin"?{}:{active:true};
  const services=await RepairService.find(filter).populate("partner","name role").sort("name");
  res.json(services);
 }catch(e){next(e)}
});
r.post("/repair-services",auth,roles("repair_partner","admin"),async(req,res,next)=>{
 try{
  const {input,error}=validateRepairServiceInput(req.body);
  if(error) return res.status(400).json({message:error});
  const service=await RepairService.create({...input,partner:req.user._id});
  res.status(201).json(service);
 }catch(e){next(e)}
});
r.get("/repair-services/:id",optionalAuth,async(req,res,next)=>{
 try{
  if(!validId(req.params.id)) return res.status(400).json({message:"Invalid service ID"});
  const service=await RepairService.findById(req.params.id).populate("partner","name role");
  if(!service) return res.status(404).json({message:"Repair service not found"});
  const userId=(req.user?._id||req.user?.id)?.toString();
  const isOwner=userId===service.partner?._id?.toString();
  if(!service.active&&!isOwner&&req.user?.role!=="admin") return res.status(404).json({message:"Repair service not found"});
  res.json(service);
 }catch(e){next(e)}
});
r.post("/repair-bookings",auth,roles("buyer","admin"),async(req,res,next)=>{
 try{
  if(!hasOnlyKeys(req.body,["service","scheduledAt","notes","itemType","serviceMethod"])) return res.status(400).json({message:"Provide only service, scheduledAt, notes, itemType, and serviceMethod"});
  const {service:serviceId,scheduledAt,notes,itemType="clothing",serviceMethod="drop_off"}=req.body||{};
  if(!validId(serviceId)) return res.status(400).json({message:"A valid repair service ID is required"});
  if(typeof scheduledAt!=="string"||!Number.isFinite(Date.parse(scheduledAt))||new Date(scheduledAt)<=new Date()) return res.status(400).json({message:"scheduledAt must be a valid future date"});
  if(notes!==undefined&&(typeof notes!=="string"||notes.length>2000)) return res.status(400).json({message:"notes must be a string of at most 2000 characters"});
  if(!["clothing","footwear","bag","accessory"].includes(itemType)) return res.status(400).json({message:"itemType must be clothing, footwear, bag, or accessory"});
  if(!["drop_off","pickup"].includes(serviceMethod)) return res.status(400).json({message:"serviceMethod must be drop_off or pickup"});
  const service=await RepairService.findOne({_id:serviceId,active:true});
  if(!service) return res.status(404).json({message:"Active repair service not found"});
  const booking=await RepairBooking.create({
   service:service._id,
   partner:service.partner,
   buyer:req.user._id,
   scheduledAt:new Date(scheduledAt),
   itemType,
   serviceMethod,
   notes:notes?.trim(),
   price:service.price
  });
  res.status(201).json(booking);
 }catch(e){next(e)}
});
r.get("/repair-bookings",auth,async(req,res,next)=>{
 try{
  let filter;
  if(req.user.role==="admin") filter={};
  else if(req.user.role==="repair_partner") filter={partner:req.user._id};
  else if(req.user.role==="buyer") filter={buyer:req.user._id};
  else return res.status(403).json({message:"Forbidden"});
  const bookings=await RepairBooking.find(filter)
   .populate("service","name category location durationMinutes")
   .populate("buyer","name")
   .populate("partner","name")
   .sort("-scheduledAt");
  res.json(bookings);
 }catch(e){next(e)}
});
r.patch("/repair-bookings/:id/status",auth,async(req,res,next)=>{
 try{
  if(!validId(req.params.id)) return res.status(400).json({message:"Invalid booking ID"});
  if(!hasOnlyKeys(req.body,["status"])||Object.keys(req.body).length!==1) return res.status(400).json({message:"Provide only the booking status"});
  const nextStatus=req.body?.status;
  if(typeof nextStatus!=="string"||!["requested","confirmed","in_progress","completed","cancelled"].includes(nextStatus)) return res.status(400).json({message:"Invalid booking status"});
  const booking=await RepairBooking.findById(req.params.id);
  if(!booking) return res.status(404).json({message:"Repair booking not found"});
  const isAdmin=req.user.role==="admin";
  const isPartner=req.user.role==="repair_partner"&&booking.partner?.toString()===req.user._id.toString();
  const isBuyer=req.user.role==="buyer"&&booking.buyer.toString()===req.user._id.toString();
  if(!isAdmin&&!isPartner&&!isBuyer) return res.status(404).json({message:"Repair booking not found"});
  if(isBuyer&&nextStatus!=="cancelled") return res.status(403).json({message:"Buyers may only cancel their own requested bookings"});
  if(isBuyer&&booking.status!=="requested") return res.status(409).json({message:"Only requested bookings may be cancelled by the buyer"});
  const permitted=repairBookingTransitions[booking.status]||[];
  if(!permitted.includes(nextStatus)) return res.status(409).json({message:"Booking status transition is not allowed"});
  booking.status=nextStatus;
  await booking.save();
  res.json(booking);
 }catch(e){next(e)}
});

//
// 4 Impact APIs
//
r.get("/impact/listing/:listingId",optionalAuth,async(req,res,next)=>{
 try{
  const listing=await findGradeListing(req,req.params.listingId);
  res.json(listingImpact(listing));
 }catch(e){next(e)}
});
r.get("/impact/order/:orderId",auth,async(req,res,next)=>{
 try{
  if(!validId(req.params.orderId)) return res.status(400).json({message:"Invalid order ID"});
  const access=orderAccessQuery(req.user);
  if(!access) return res.status(403).json({message:"Forbidden"});
  const order=await Order.findOne({_id:req.params.orderId,...access});
  if(!order) return res.status(404).json({message:"Order not found"});
  if(order.payment?.status!=="succeeded"||order.status==="cancelled") return res.status(409).json({message:"Impact is available only for successfully paid, non-cancelled orders"});
  res.json(formatImpact(orderImpact(order)));
 }catch(e){next(e)}
});
r.get("/impact/me",auth,roles("buyer","seller"),async(req,res,next)=>{
 try{
  const activityType=req.user.role==="seller"?"sales":"purchases";
  const ownerField=activityType==="sales"?"seller":"buyer";
  const orders=await Order.find({
   [ownerField]:req.user._id,
   status:{$in:["paid","processing","shipped","delivered"]},
   "payment.status":"succeeded"
  }).sort("-createdAt");
  const records=orders.map((order)=>({
   order:order._id,
   createdAt:order.createdAt,
   pieces:order.items.reduce((count,item)=>count+(Number(item.quantity)||1),0),
   ...formatImpact(orderImpact(order))
  }));
  const total=records.reduce((sum,record)=>{
   sum.waterSaved+=record.waterSaved;
   sum.co2Saved+=record.co2Saved;
   sum.score+=record.score;
   sum.pieces+=record.pieces;
   sum.estimated=sum.estimated||record.estimated;
   return sum;
  },{waterSaved:0,co2Saved:0,score:0,pieces:0,estimated:false});
  res.json({activityType,records,...formatImpact(total),pieces:total.pieces});
 }catch(e){next(e)}
});
r.post("/impact/calculate",async(req,res,next)=>{
 try{
  const body=req.body;
  if(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).some((key)=>key!=="price")) return res.status(400).json({message:"Provide only a numeric price"});
  if(typeof body.price!=="number"||!Number.isFinite(body.price)||body.price<0||body.price>Number.MAX_SAFE_INTEGER/2) return res.status(400).json({message:"price must be a non-negative, safely representable number"});
  res.json(demoImpact(body.price));
 }catch(e){next(e)}
});

//
// 4 Reviews
//
r.post("/reviews",auth,roles("buyer"),async(req,res,next)=>{
 try{
  const {listing:listingId,...reviewBody}=req.body||{};
  if(!validId(listingId)) return res.status(400).json({message:"A valid listing ID is required"});
  const {input,error}=reviewInput(reviewBody);
  if(error) return res.status(400).json({message:error});
  const listing=await Listing.findById(listingId);
  if(!listing) return res.status(404).json({message:"Listing not found"});
  const purchase=await Order.findOne({
   buyer:req.user._id,
   status:"delivered",
   "payment.status":"succeeded",
   "items.listing":listing._id
  }).select("_id");
  if(!purchase) return res.status(403).json({message:"A delivered, paid purchase is required to review this listing"});
  const existing=await Review.findOne({listing:listing._id,author:req.user._id});
  if(existing) return res.status(409).json({message:"You have already reviewed this listing"});
  const review=await Review.create({...input,listing:listing._id,author:req.user._id});
  res.status(201).json(await review.populate("author","name"));
 }catch(e){
  if(e.code===11000) return res.status(409).json({message:"You have already reviewed this listing"});
  next(e);
 }
});
r.get("/reviews/listing/:listingId",async(req,res,next)=>{
 try{
  if(!validId(req.params.listingId)) return res.status(400).json({message:"Invalid listing ID"});
  const listing=await Listing.findById(req.params.listingId).select("_id");
  if(!listing) return res.status(404).json({message:"Listing not found"});
  const reviews=await Review.find({listing:listing._id}).populate("author","name").sort("-createdAt");
  const averageRating=reviews.length?Number((reviews.reduce((sum,review)=>sum+review.rating,0)/reviews.length).toFixed(2)):null;
  res.json({reviews,total:reviews.length,averageRating});
 }catch(e){next(e)}
});
r.put("/reviews/:id",auth,roles("buyer","admin"),async(req,res,next)=>{
 try{
  if(!validId(req.params.id)) return res.status(400).json({message:"Invalid review ID"});
  const {input,error}=reviewInput(req.body);
  if(error) return res.status(400).json({message:error});
  const filter=req.user.role==="admin"?{_id:req.params.id}:{_id:req.params.id,author:req.user._id};
  const review=await Review.findOneAndUpdate(filter,input,{new:true,runValidators:true}).populate("author","name");
  if(!review) return res.status(404).json({message:"Review not found"});
  res.json(review);
 }catch(e){next(e)}
});
r.delete("/reviews/:id",auth,roles("buyer","admin"),async(req,res,next)=>{
 try{
  if(!validId(req.params.id)) return res.status(400).json({message:"Invalid review ID"});
  if(!isEmptyBody(req.body)) return res.status(400).json({message:"Delete request body must be empty"});
  const filter=req.user.role==="admin"?{_id:req.params.id}:{_id:req.params.id,author:req.user._id};
  const review=await Review.findOneAndDelete(filter);
  if(!review) return res.status(404).json({message:"Review not found"});
  res.json({message:"Review deleted"});
 }catch(e){next(e)}
});

//
// 6 Messaging
//
r.post("/conversations",auth,roles("buyer"),async(req,res,next)=>{
 try{
  if(!hasOnlyKeys(req.body,["listingId","userId"])) return res.status(400).json({message:"Provide only listingId and optional userId"});
  const {listingId,userId}=req.body||{};
  if(!validId(listingId)) return res.status(400).json({message:"A valid listing ID is required"});
  if(userId!==undefined&&!validId(userId)) return res.status(400).json({message:"Invalid recipient ID"});
  const listing=await Listing.findOne({_id:listingId,status:"active"}).populate("seller","role");
  if(!listing) return res.status(404).json({message:"Active listing not found"});
  if(listing.seller._id.toString()===req.user._id.toString()) return res.status(400).json({message:"You cannot start a conversation with yourself"});
  if(listing.seller.role!=="seller"&&listing.seller.role!=="admin") return res.status(409).json({message:"Listing seller cannot receive marketplace messages"});
  if(userId&&userId!==listing.seller._id.toString()) return res.status(400).json({message:"Recipient must be the listing seller"});
  const participants=[req.user._id,listing.seller._id];
  let conversation=await Conversation.findOne({listing:listing._id,participants:{$all:participants}});
  let created=false;
  if(!conversation){
   conversation=await Conversation.create({participants,listing:listing._id});
   created=true;
  }
  await conversation.populate("participants","name role");
  await conversation.populate("listing","title images");
  res.status(created?201:200).json(conversation);
 }catch(e){next(e)}
});
r.get("/conversations",auth,async(req,res,next)=>{
 try{
  const conversations=await Conversation.find({participants:req.user._id})
   .populate("participants","name role")
   .populate("listing","title images")
   .sort("-updatedAt");
  const results=await Promise.all(conversations.map(async(conversation)=>{
   const latest=await Message.findOne({conversation:conversation._id}).sort("-createdAt").select("text sender createdAt");
   const unreadCount=await Message.countDocuments({conversation:conversation._id,sender:{$ne:req.user._id},read:false});
   return {...conversation.toObject(),latestMessage:latest,unreadCount};
  }));
  res.json(results);
 }catch(e){next(e)}
});
r.get("/conversations/:id",auth,async(req,res,next)=>{
 try{
  const conversation=await findConversationForUser(req.params.id,req.user._id);
  const messages=await Message.find({conversation:conversation._id}).populate("sender","name role").sort("createdAt");
  res.json(messages);
 }catch(e){next(e)}
});
r.post("/conversations/:id/messages",auth,async(req,res,next)=>{
 try{
  const conversation=await findConversationForUser(req.params.id,req.user._id);
  if(!hasOnlyKeys(req.body,["text"])||Object.keys(req.body).length!==1) return res.status(400).json({message:"Provide only message text"});
  const {text}=req.body||{};
  if(typeof text!=="string"||!text.trim()||text.trim().length>4000) return res.status(400).json({message:"text is required and must be at most 4000 characters"});
  const message=await Message.create({conversation:conversation._id,sender:req.user._id,text:text.trim()});
  conversation.updatedAt=new Date();
  await conversation.save();
  res.status(201).json(await message.populate("sender","name role"));
 }catch(e){next(e)}
});
r.patch("/messages/:id/read",auth,async(req,res,next)=>{
 try{
  if(!validId(req.params.id)) return res.status(400).json({message:"Invalid message ID"});
  if(!isEmptyBody(req.body)) return res.status(400).json({message:"Read request body must be empty"});
  const message=await Message.findById(req.params.id);
  if(!message) return res.status(404).json({message:"Message not found"});
  await findConversationForUser(message.conversation,req.user._id);
  if(message.sender.toString()===req.user._id.toString()) return res.status(400).json({message:"You cannot mark your own message as read"});
  if(!message.read){
   message.read=true;
   await message.save();
  }
  res.json(message);
 }catch(e){next(e)}
});
r.delete("/messages/:id",auth,async(req,res,next)=>{
 try{
  if(!validId(req.params.id)) return res.status(400).json({message:"Invalid message ID"});
  if(!isEmptyBody(req.body)) return res.status(400).json({message:"Delete request body must be empty"});
  const message=await Message.findOne({_id:req.params.id,sender:req.user._id});
  if(!message) return res.status(404).json({message:"Message not found"});
  await findConversationForUser(message.conversation,req.user._id);
  await message.deleteOne();
  res.json({message:"Message deleted"});
 }catch(e){next(e)}
});

//
// 5 Admin
//
r.get("/admin/dashboard",auth,roles("admin"),async(req,res,next)=>{
 try{
  const [users,listings,orders,openReports,reviewingReports,resolvedReports]=await Promise.all([
   User.countDocuments(),
   Listing.countDocuments(),
   Order.countDocuments(),
   Report.countDocuments({status:"open"}),
   Report.countDocuments({status:"reviewing"}),
   Report.countDocuments({status:{$in:["resolved","rejected"]}})
  ]);
  res.json({users,listings,orders,reports:{open:openReports,reviewing:reviewingReports,closed:resolvedReports}});
 }catch(e){next(e)}
});
r.get("/admin/reports",auth,roles("admin"),async(req,res,next)=>{
 try{
  const reports=await Report.find()
   .populate("reporter","name role")
   .sort("-createdAt");
  const results=await Promise.all(reports.map(async(report)=>{
   const Target=reportTargets[report.targetType];
   const target=Target?await Target.findById(report.targetId).select("name title text reason status").lean():null;
   return {...report.toObject(),target};
  }));
  res.json(results);
 }catch(e){next(e)}
});
r.post("/admin/reports",auth,async(req,res,next)=>{
 try{
  const {targetType,targetId,reason,details}=req.body||{};
  if(Object.keys(req.body||{}).some((key)=>!["targetType","targetId","reason","details"].includes(key))) return res.status(400).json({message:"Unsupported report field"});
  if(typeof targetType!=="string"||!Object.prototype.hasOwnProperty.call(reportTargets,targetType)) return res.status(400).json({message:"Invalid report target type"});
  if(!validId(targetId)) return res.status(400).json({message:"A valid target ID is required"});
  if(typeof reason!=="string"||!reason.trim()||reason.trim().length>120) return res.status(400).json({message:"reason is required and must be at most 120 characters"});
  if(details!==undefined&&(typeof details!=="string"||details.trim().length>2000)) return res.status(400).json({message:"details must be at most 2000 characters"});
  const target=await reportTargets[targetType].findById(targetId).select("_id");
  if(!target) return res.status(404).json({message:"Report target not found"});
  const report=await Report.create({reporter:req.user._id,targetType,targetId:target._id,reason:reason.trim(),details:details?.trim()});
  res.status(201).json(report);
 }catch(e){next(e)}
});
r.patch("/admin/reports/:id",auth,roles("admin"),async(req,res,next)=>{
 try{
  if(!validId(req.params.id)) return res.status(400).json({message:"Invalid report ID"});
  if(!req.body||Object.keys(req.body).length!==1||!["open","reviewing","resolved","rejected"].includes(req.body.status)) return res.status(400).json({message:"A valid report status is required"});
  const report=await Report.findById(req.params.id);
  if(!report) return res.status(404).json({message:"Report not found"});
  const transitions={open:["reviewing","resolved","rejected"],reviewing:["open","resolved","rejected"],resolved:[],rejected:[]};
  if(!transitions[report.status]?.includes(req.body.status)) return res.status(409).json({message:"Report status transition is not allowed"});
  report.status=req.body.status;
  await report.save();
  await report.populate("reporter","name role");
  res.json(report);
 }catch(e){next(e)}
});
r.patch("/admin/listings/:id/moderate",auth,roles("admin"),async(req,res,next)=>{
 try{
  if(!validId(req.params.id)) return res.status(400).json({message:"Invalid listing ID"});
  if(!req.body||Object.keys(req.body).length!==1||!["active","paused","rejected"].includes(req.body.status)) return res.status(400).json({message:"Moderation status must be active, paused, or rejected"});
  const listing=await Listing.findById(req.params.id);
  if(!listing) return res.status(404).json({message:"Listing not found"});
  if(listing.status==="sold") return res.status(409).json({message:"Sold listings cannot be changed through moderation"});
  listing.status=req.body.status;
  await listing.save();
  await listing.populate("seller","name role");
  res.json(listing);
 }catch(e){next(e)}
});

//
// 5 Auction
//
r.post("/auctions",auth,roles("seller","admin"),async(req,res,next)=>{
 try{
  const {listing:listingId,startingBid,endsAt}=req.body||{};
  if(Object.keys(req.body||{}).some((key)=>!["listing","startingBid","endsAt"].includes(key))) return res.status(400).json({message:"Unsupported auction field"});
  if(!validId(listingId)) return res.status(400).json({message:"A valid listing ID is required"});
  if(typeof startingBid!=="number"||!Number.isFinite(startingBid)||startingBid<=0) return res.status(400).json({message:"startingBid must be a positive number"});
  if(typeof endsAt!=="string"||!Number.isFinite(Date.parse(endsAt))||new Date(endsAt)<=new Date()) return res.status(400).json({message:"endsAt must be a valid future date"});
  const listingFilter={_id:listingId,status:"active",isAuction:{$ne:true}};
  if(req.user.role!=="admin") listingFilter.seller=req.user._id;
  const listing=await Listing.findOne(listingFilter);
  if(!listing) return res.status(404).json({message:"An active listing owned by you is required"});
  const reserved=await Listing.findOneAndUpdate(
   {_id:listing._id,status:"active",isAuction:{$ne:true}},
   {status:"paused",isAuction:true},
   {new:true}
  );
  if(!reserved) return res.status(409).json({message:"Listing is no longer available for auction"});
  try{
   const auction=await Auction.create({
    listing:listing._id,
    seller:listing.seller,
    startingBid,
    currentBid:startingBid,
    endsAt:new Date(endsAt)
   });
   await auction.populate("listing");
   await auction.populate("seller","name role");
   res.status(201).json(auction);
  }catch(e){
   await Listing.findOneAndUpdate({_id:listing._id,status:"paused",isAuction:true},{status:"active",isAuction:false});
   if(e.code===11000) return res.status(409).json({message:"An active auction already exists for this listing"});
   throw e;
  }
 }catch(e){next(e)}
});
r.get("/auctions",async(req,res,next)=>{
 try{
  const expired=await Auction.find({status:"active",endsAt:{$lte:new Date()}});
  await Promise.all(expired.map(closeExpiredAuction));
  const auctions=await Auction.find({status:"active",endsAt:{$gt:new Date()}})
   .populate("listing")
   .populate("seller","name role")
   .populate("currentBidder","name")
   .sort("endsAt");
  res.json(auctions);
 }catch(e){next(e)}
});
r.get("/auctions/:id",async(req,res,next)=>{
 try{
  if(!validId(req.params.id)) return res.status(400).json({message:"Invalid auction ID"});
  let auction=await Auction.findById(req.params.id);
  if(!auction) return res.status(404).json({message:"Auction not found"});
  auction=await closeExpiredAuction(auction);
  await auction.populate("listing");
  await auction.populate("seller","name role");
  await auction.populate("winner","name");
  const bids=await Bid.find({auction:auction._id}).populate("bidder","name").sort("-amount -createdAt").limit(20);
  res.json({...auction.toObject(),bids});
 }catch(e){next(e)}
});
r.post("/auctions/:id/bids",auth,roles("buyer"),async(req,res,next)=>{
 try{
  if(!validId(req.params.id)) return res.status(400).json({message:"Invalid auction ID"});
  if(!req.body||Object.keys(req.body).length!==1||typeof req.body.amount!=="number"||!Number.isFinite(req.body.amount)||req.body.amount<=0) return res.status(400).json({message:"amount must be a positive number"});
  const auction=await Auction.findById(req.params.id);
  if(!auction) return res.status(404).json({message:"Auction not found"});
  if(auction.seller.toString()===req.user._id.toString()) return res.status(403).json({message:"Sellers cannot bid on their own auction"});
  if(auction.status!=="active"||auction.endsAt<=new Date()) return res.status(409).json({message:"Auction is closed"});
  if(req.body.amount<=auction.currentBid) return res.status(400).json({message:"Bid must exceed current bid"});
  const bid=await Bid.create({auction:auction._id,bidder:req.user._id,amount:req.body.amount});
  const updated=await Auction.findOneAndUpdate(
   {_id:auction._id,status:"active",endsAt:{$gt:new Date()},currentBid:{$lt:req.body.amount}},
   {currentBid:req.body.amount,currentBidder:req.user._id},
   {new:true}
  );
  if(!updated){
   await Bid.deleteOne({_id:bid._id});
   return res.status(409).json({message:"Auction changed while placing your bid; refresh and try again"});
  }
  res.status(201).json(await bid.populate("bidder","name"));
 }catch(e){next(e)}
});
r.post("/auctions/:id/close",auth,roles("seller","admin"),async(req,res,next)=>{
 try{
  if(!validId(req.params.id)) return res.status(400).json({message:"Invalid auction ID"});
  if(!isEmptyBody(req.body)) return res.status(400).json({message:"Close request body must be empty"});
  const auction=await Auction.findById(req.params.id);
  if(!auction) return res.status(404).json({message:"Auction not found"});
  if(req.user.role!=="admin"&&auction.seller.toString()!==req.user._id.toString()) return res.status(404).json({message:"Auction not found"});
  if(auction.status==="closed") return res.status(409).json({message:"Auction is already closed"});
  if(auction.endsAt>new Date()&&req.user.role!=="admin") return res.status(409).json({message:"Only an admin can close an auction before its scheduled end"});
  const closed=await Auction.findOneAndUpdate(
   {_id:auction._id,status:"active"},
   {status:"closed",winner:auction.currentBidder||null},
   {new:true}
  );
  if(!closed) return res.status(409).json({message:"Auction has already been closed"});
  if(!closed.winner){
   await Listing.findOneAndUpdate({_id:closed.listing,isAuction:true,status:"paused"},{status:"active",isAuction:false});
  }
  await closed.populate("listing");
  await closed.populate("winner","name");
  const winningBid=closed.winner?await Bid.findOne({auction:closed._id,bidder:closed.winner,amount:closed.currentBid}).populate("bidder","name"):null;
  res.json({auction:closed,winner:winningBid});
 }catch(e){next(e)}
});

export default r;
