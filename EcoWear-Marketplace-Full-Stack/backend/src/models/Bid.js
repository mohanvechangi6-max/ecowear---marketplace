import mongoose from "mongoose";
const schema=new mongoose.Schema({
 auction:{type:mongoose.Schema.Types.ObjectId,ref:"Auction",required:true},
 bidder:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true},
 amount:{type:Number,required:true,min:0.01}
},{timestamps:true});
schema.index({auction:1,amount:-1});
export default mongoose.model("Bid",schema);