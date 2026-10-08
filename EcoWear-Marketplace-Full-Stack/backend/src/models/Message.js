import mongoose from "mongoose";
const schema=new mongoose.Schema({
 conversation:{type:mongoose.Schema.Types.ObjectId,ref:"Conversation",required:true},
 sender:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true},
 text:{type:String,required:true,trim:true,maxLength:4000},
 read:{type:Boolean,default:false}
},{timestamps:true});
export default mongoose.model("Message",schema);