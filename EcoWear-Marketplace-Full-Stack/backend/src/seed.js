import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "./models/User.js";
import Listing from "./models/Listing.js";
import Order from "./models/Order.js";
import RepairService from "./models/RepairService.js";
import Auction from "./models/Auction.js";
import Bid from "./models/Bid.js";
import Conversation from "./models/Conversation.js";
import Message from "./models/Message.js";

dotenv.config();

if(process.env.NODE_ENV==="production"){
 throw new Error("Demo seeding is disabled in production");
}

const demoPassword=process.env.DEMO_PASSWORD||"Demo@12345";
if(Buffer.byteLength(demoPassword,"utf8")<8||Buffer.byteLength(demoPassword,"utf8")>72){
 throw new Error("DEMO_PASSWORD must be between 8 and 72 UTF-8 bytes");
}

try{
 await mongoose.connect(process.env.MONGODB_URI||"mongodb://127.0.0.1:27017/ecowear");
 const password=await bcrypt.hash(demoPassword,12);
 const accounts=[
  {name:"Asha Studio",email:"seller@ecowear.demo",role:"seller"},
  {name:"Demo Buyer",email:"buyer@ecowear.demo",role:"buyer"},
  {name:"Repair Hub",email:"repair@ecowear.demo",role:"repair_partner"},
  {name:"Admin",email:"admin@ecowear.demo",role:"admin"}
 ];
 for(const account of accounts){
  await User.updateOne(
   {email:account.email},
   {$setOnInsert:{...account,password}},
   {upsert:true}
  );
 }
 const seller=await User.findOne({email:"seller@ecowear.demo"}).select("_id");
 const buyer=await User.findOne({email:"buyer@ecowear.demo"}).select("_id");
 const repairPartner=await User.findOne({email:"repair@ecowear.demo"}).select("_id");
 const listings=[
  {title:"Organic Linen Overshirt",description:"Relaxed-fit linen overshirt in excellent condition.",category:"Shirts",brand:"Earth Loom",location:"Mumbai",size:"M",color:"Sage",material:"Organic linen",condition:"excellent",price:1499,images:["https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=900&q=85"],status:"active",impact:{waterSaved:4200,co2Saved:9.4,score:92}},
  {title:"Vintage Denim Jacket",description:"Classic denim jacket ready for a second life.",category:"Jackets",brand:"ReThread",location:"Bengaluru",size:"L",color:"Indigo",material:"Denim",condition:"good",price:1899,images:["https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=900&q=85"],status:"active",impact:{waterSaved:3900,co2Saved:10.1,score:89}},
  {title:"Soft Cotton Pocket T-shirt",description:"Everyday cotton T-shirt with a relaxed fit and chest pocket.",category:"T-shirts",brand:"Uniqlo",location:"Visakhapatnam",size:"S",color:"Cream",material:"Cotton",condition:"excellent",price:599,images:["https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=900&q=85"],status:"active",impact:{waterSaved:2600,co2Saved:7.8,score:65}},
  {title:"High-rise Straight Jeans",description:"Classic blue denim jeans with a comfortable straight-leg cut.",category:"Jeans",brand:"Levi's",location:"Visakhapatnam",size:"XL",color:"Blue",material:"Denim",condition:"good",price:1599,images:["https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=900&q=85"],status:"active",impact:{waterSaved:3700,co2Saved:10.2,score:84}},
  {title:"Wool Blend Cardigan",description:"A warm, easy-to-layer cardigan in a versatile neutral shade.",category:"Knitwear",brand:"H&M",location:"Visakhapatnam",size:"M",color:"Grey",material:"Wool",condition:"excellent",price:999,images:["https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=900&q=85"],status:"active",impact:{waterSaved:2300,co2Saved:7.1,score:72}},
  {title:"Recycled Running Shirt",description:"Lightweight performance shirt made for everyday movement.",category:"T-shirts",brand:"Adidas",location:"Visakhapatnam",size:"XXL",color:"Black",material:"Recycled polyester",condition:"good",price:799,images:["https://images.unsplash.com/photo-1523398002811-999ca8dec234?auto=format&fit=crop&w=900&q=85"],status:"active",impact:{waterSaved:2100,co2Saved:6.8,score:69}}
 ];
 for(const listing of listings){
  await Listing.updateOne(
   {seller:seller._id,title:listing.title},
   {$set:{...listing,seller:seller._id}},
   {upsert:true}
  );
 }
 const messageListing=await Listing.findOne({seller:seller._id,title:"Organic Linen Overshirt"}).select("_id");
 let conversation=await Conversation.findOne({listing:messageListing._id,participants:{$all:[buyer._id,seller._id]}});
 if(!conversation){
  conversation=await Conversation.create({participants:[buyer._id,seller._id],listing:messageListing._id});
 }
 if(await Message.countDocuments({conversation:conversation._id})===0){
  await Message.insertMany([
   {conversation:conversation._id,sender:buyer._id,text:"Hi! Is the Organic Linen Overshirt still available?",read:true},
   {conversation:conversation._id,sender:seller._id,text:"Hello! Yes, it is available and in excellent condition.",read:true},
   {conversation:conversation._id,sender:buyer._id,text:"Could you confirm whether the color is closer to sage green?",read:true},
   {conversation:conversation._id,sender:seller._id,text:"Yes, it is a soft sage green. I can share more details if needed.",read:true},
   {conversation:conversation._id,sender:buyer._id,text:"Perfect, thank you. I will add it to my cart today.",read:false}
  ]);
  conversation.updatedAt=new Date();
  await conversation.save();
 }
 const completedListings=[
  {title:"Reclaimed Cotton T-shirt",description:"A soft cotton tee ready for its next chapter.",category:"T-shirts",brand:"EcoWear",location:"Visakhapatnam",size:"M",color:"Navy",material:"Cotton",condition:"excellent",price:699,impact:{waterSaved:2700,co2Saved:8.2,score:68}},
  {title:"Classic Indigo Jeans",description:"Well-made denim jeans with years of wear left.",category:"Jeans",brand:"Levi's",location:"Visakhapatnam",size:"XL",color:"Blue",material:"Denim",condition:"good",price:1299,impact:{waterSaved:3800,co2Saved:10.4,score:85}}
 ];
 for(const listing of completedListings){
  await Listing.updateOne(
   {seller:seller._id,title:listing.title},
   {$setOnInsert:{...listing,seller:seller._id,status:"sold"}},
   {upsert:true}
  );
 }
 const completedPieces=await Listing.find({seller:seller._id,title:{$in:completedListings.map((listing)=>listing.title)}});
 for(const piece of completedPieces){
  let order=await Order.findOne({buyer:buyer._id,"items.listing":piece._id});
  if(!order){
   order=await Order.create({
    buyer:buyer._id,
    seller:seller._id,
    items:[{listing:piece._id,price:piece.price,quantity:1,impact:{...piece.impact,estimated:true}}],
    total:piece.price,
    status:"delivered",
    payment:{status:"succeeded",provider:"demo",transactionId:`demo-${piece._id}`},
    shippingAddress:{name:"Demo Buyer",line1:"Beach Road",city:"Visakhapatnam",postalCode:"530001",country:"India"}
   });
  }
  await Listing.updateOne({_id:piece._id},{$set:{status:"sold",soldOrder:order._id}});
 }
 const auctionListings=[
  {title:"Handwoven Indigo Tote",description:"A one-of-a-kind handwoven tote with a natural cotton lining.",category:"Accessories",brand:"Artisan Edit",location:"Visakhapatnam",size:"One size",color:"Indigo",material:"Cotton",condition:"excellent",price:850,images:["https://images.unsplash.com/photo-1591561954557-26941169b49e?auto=format&fit=crop&w=900&q=85"],impact:{waterSaved:1800,co2Saved:5.6,score:62},startingBid:650,days:5},
  {title:"Vintage Leather Jacket",description:"A characterful vintage leather jacket with a timeless cut.",category:"Jackets",brand:"Vintage Find",location:"Visakhapatnam",size:"XL",color:"Brown",material:"Leather",condition:"good",price:2499,images:["https://images.unsplash.com/photo-1521223890158-f9f7c3d5d504?auto=format&fit=crop&w=900&q=85"],impact:{waterSaved:3200,co2Saved:9.8,score:81},startingBid:1800,days:8}
 ];
 for(const auctionItem of auctionListings){
  const {startingBid,days,...listing}=auctionItem;
  await Listing.updateOne(
   {seller:seller._id,title:listing.title},
   {$set:{...listing,seller:seller._id,status:"paused",isAuction:true}},
   {upsert:true}
  );
  const auctionListing=await Listing.findOne({seller:seller._id,title:listing.title}).select("_id");
  const existingAuction=await Auction.findOne({listing:auctionListing._id,status:"active"});
  if(!existingAuction){
   await Auction.create({listing:auctionListing._id,seller:seller._id,startingBid,currentBid:startingBid,endsAt:new Date(Date.now()+days*24*60*60*1000)});
  }
 }
 const leatherJacket=await Listing.findOne({seller:seller._id,title:"Vintage Leather Jacket"}).select("_id");
 const leatherAuction=await Auction.findOne({listing:leatherJacket._id,status:"active"});
 if(leatherAuction&&await Bid.countDocuments({auction:leatherAuction._id})===0){
  await Bid.insertMany([
   {auction:leatherAuction._id,bidder:buyer._id,amount:1900},
   {auction:leatherAuction._id,bidder:buyer._id,amount:2050}
  ]);
  leatherAuction.currentBid=2050;
  leatherAuction.currentBidder=buyer._id;
  await leatherAuction.save();
 }
 const repairServices=[
  {name:"Zip & Stitch",description:"Zips, seams, buttons and alterations.",category:"Alteration",price:399,durationMinutes:60},
  {name:"Denim Revival",description:"Repair tears, reinforce seams and patch your favorite jeans.",category:"Clothing repair",price:499,durationMinutes:75},
  {name:"Hem & Fit",description:"Adjust trouser, skirt and dress lengths for a better fit.",category:"Alteration",price:299,durationMinutes:45},
  {name:"Knitwear Rescue",description:"Mend small holes and refresh loose seams in knitwear.",category:"Clothing repair",price:449,durationMinutes:60},
  {name:"Button & Seam Repair",description:"Replace missing buttons and repair everyday garment seams.",category:"Clothing repair",price:199,durationMinutes:30}
 ];
 for(const service of repairServices){
  await RepairService.updateOne(
   {partner:repairPartner._id,name:service.name},
   {$setOnInsert:{...service,partner:repairPartner._id,location:"Visakhapatnam"}},
   {upsert:true}
  );
 }
 console.log("Demo accounts and sample marketplace data are ready.");
 console.log(`Demo password: ${process.env.DEMO_PASSWORD?"(configured by DEMO_PASSWORD)":"Demo@12345 (change it before sharing this environment)"}`);
}finally{
 await mongoose.disconnect();
}
