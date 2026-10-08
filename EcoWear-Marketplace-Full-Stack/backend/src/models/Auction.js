import mongoose from "mongoose";
const schema=new mongoose.Schema({
 listing:{type:mongoose.Schema.Types.ObjectId,ref:"Listing",required:true},
 seller:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true},
 startingBid:{type:Number,required:true,min:0.01},
 currentBid:{type:Number,required:true,min:0.01},
 currentBidder:{type:mongoose.Schema.Types.ObjectId,ref:"User",default:null},
 endsAt:{type:Date,required:true},
 status:{type:String,enum:["active","closed"],default:"active"},
 winner:{type:mongoose.Schema.Types.ObjectId,ref:"User",default:null}
},{timestamps:true});
schema.index({listing:1},{unique:true,partialFilterExpression:{status:"active"}});
export default mongoose.model("Auction",schema);