import mongoose from "mongoose";
const schema=new mongoose.Schema({
 partner:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true},
 name:{type:String,required:true,trim:true},
 description:{type:String,required:true,trim:true},
 category:{type:String,required:true,trim:true},
 price:{type:Number,required:true,min:0},
 durationMinutes:{type:Number,required:true,min:1},
 location:{type:String,required:true,trim:true},
 active:{type:Boolean,default:true}
},{timestamps:true});
export default mongoose.model("RepairService",schema);