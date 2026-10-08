import mongoose from "mongoose";
const schema=new mongoose.Schema({
 participants:{type:[{type:mongoose.Schema.Types.ObjectId,ref:"User"}],required:true,validate:{validator:(users)=>users.length===2&&new Set(users.map(String)).size===2,message:"A conversation must have two unique participants"}},
 listing:{type:mongoose.Schema.Types.ObjectId,ref:"Listing",required:true}
},{timestamps:true});
schema.index({listing:1,participants:1});
export default mongoose.model("Conversation",schema);