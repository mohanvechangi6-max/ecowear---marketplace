import mongoose from "mongoose";
const schema=new mongoose.Schema({
 name:{type:String,required:true,trim:true}, email:{type:String,required:true,unique:true,lowercase:true},
 password:{type:String,required:true,select:false}, role:{type:String,enum:["buyer","seller","repair_partner","admin"],default:"buyer"},
 avatar:String, phone:String, address:Object
},{
 timestamps:true,
 toJSON:{transform(_document,record){delete record.password;return record;}},
 toObject:{transform(_document,record){delete record.password;return record;}}
});
export default mongoose.model("User",schema);