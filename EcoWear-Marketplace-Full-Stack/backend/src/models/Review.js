import mongoose from "mongoose";
const schema=new mongoose.Schema({
 listing:{type:mongoose.Schema.Types.ObjectId,ref:"Listing",required:true},
 author:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true},
 rating:{type:Number,required:true,min:1,max:5,validate:Number.isInteger},
 comment:{type:String,required:true,trim:true,maxLength:2000}
},{timestamps:true});
schema.index({listing:1,author:1},{unique:true});
export default mongoose.model("Review",schema);