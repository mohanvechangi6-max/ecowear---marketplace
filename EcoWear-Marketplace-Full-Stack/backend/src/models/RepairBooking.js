import mongoose from "mongoose";
const schema=new mongoose.Schema({
 service:{type:mongoose.Schema.Types.ObjectId,ref:"RepairService",required:true},
 partner:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true},
 buyer:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true},
 scheduledAt:{type:Date,required:true},
 itemType:{type:String,enum:["clothing","footwear","bag","accessory"],default:"clothing"},
 serviceMethod:{type:String,enum:["drop_off","pickup"],default:"drop_off"},
 notes:{type:String,trim:true,maxLength:2000},
 status:{type:String,enum:["requested","confirmed","in_progress","completed","cancelled"],default:"requested"},
 price:{type:Number,required:true,min:0}
},{timestamps:true});
export default mongoose.model("RepairBooking",schema);
