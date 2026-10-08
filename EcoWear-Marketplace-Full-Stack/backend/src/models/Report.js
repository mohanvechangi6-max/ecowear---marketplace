import mongoose from "mongoose";
const schema=new mongoose.Schema({
 reporter:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true},
 targetType:{type:String,enum:["listing","user","review","message","conversation"],required:true},
 targetId:{type:mongoose.Schema.Types.ObjectId,required:true},
 reason:{type:String,required:true,trim:true,maxLength:120},
 details:{type:String,trim:true,maxLength:2000},
 status:{type:String,enum:["open","reviewing","resolved","rejected"],default:"open"}
},{timestamps:true});
export default mongoose.model("Report",schema);