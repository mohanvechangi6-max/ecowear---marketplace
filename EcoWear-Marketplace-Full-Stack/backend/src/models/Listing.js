import mongoose from "mongoose";
const schema=new mongoose.Schema({
 seller:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true}, title:{type:String,required:true},
 description:String, category:String, brand:String, location:{type:String,trim:true,maxlength:120}, size:String, color:String, material:String,
 condition:{type:String,enum:["new","excellent","good","fair","poor"],default:"good"}, price:{type:Number,min:0},
 images:[String], status:{type:String,enum:["draft","active","sold","paused","rejected"],default:"active"},
 aiGrade:Object, impact:Object, isAuction:{type:Boolean,default:false}, soldOrder:{type:mongoose.Schema.Types.ObjectId,ref:"Order",default:null}
},{timestamps:true});
export default mongoose.model("Listing",schema);