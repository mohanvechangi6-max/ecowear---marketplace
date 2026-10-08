import mongoose from "mongoose";
const schema=new mongoose.Schema({
 buyer:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true}, seller:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true}, items:[{listing:{type:mongoose.Schema.Types.ObjectId,ref:"Listing",required:true},price:{type:Number,required:true,min:0},quantity:{type:Number,required:true,min:1},impact:{waterSaved:{type:Number,min:0},co2Saved:{type:Number,min:0},score:{type:Number,min:0,max:100},estimated:{type:Boolean,default:false}}}],
 total:{type:Number,required:true,min:0},status:{type:String,enum:["pending","paid","processing","shipped","delivered","cancelled"],default:"pending"},
 payment:{status:String,provider:String,transactionId:String}, shippingAddress:Object
},{timestamps:true}); export default mongoose.model("Order",schema);