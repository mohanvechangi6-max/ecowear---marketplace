import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
const r=express.Router();
const accountRoles=["buyer","seller","repair_partner","admin"];
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validBody(body,fields){
 return body&&typeof body==="object"&&!Array.isArray(body)&&Object.keys(body).every((key)=>fields.includes(key));
}

r.post("/register",async(req,res,next)=>{
 try{
  if(!validBody(req.body,["name","email","password","role"])) return res.status(400).json({message:"Provide only name, email, password, and role"});
  const {name,email,password,role="buyer"}=req.body;
  if(typeof name!=="string"||!name.trim()||name.trim().length>100) return res.status(400).json({message:"name is required and must be at most 100 characters"});
  if(typeof email!=="string"||email.trim().length>254||!emailPattern.test(email.trim())) return res.status(400).json({message:"A valid email address is required"});
  if(typeof password!=="string"||Buffer.byteLength(password,"utf8")<8||Buffer.byteLength(password,"utf8")>72) return res.status(400).json({message:"password must be between 8 and 72 UTF-8 bytes"});
  if(typeof role!=="string"||!accountRoles.includes(role)) return res.status(400).json({message:"Invalid account role"});
  if(role==="admin"&&(process.env.NODE_ENV==="production"||process.env.ALLOW_ADMIN_REGISTER!=="true")) return res.status(403).json({message:"Admin registration disabled"});
  const normalizedEmail=email.trim().toLowerCase();
  if(await User.findOne({email:normalizedEmail})) return res.status(409).json({message:"Email already registered"});
  const user=await User.create({name:name.trim(),email:normalizedEmail,password:await bcrypt.hash(password,12),role});
  const token=jwt.sign({id:user._id},process.env.JWT_SECRET,{expiresIn:"7d"});
  res.status(201).json({token,user:{id:user._id,name:user.name,email:user.email,role:user.role}});
 }catch(e){
  if(e.code===11000) return res.status(409).json({message:"Email already registered"});
  next(e);
 }
});
r.post("/login",async(req,res,next)=>{
 try{
  if(!validBody(req.body,["email","password"])||typeof req.body.email!=="string"||typeof req.body.password!=="string"||req.body.email.length>254||Buffer.byteLength(req.body.password,"utf8")>72) return res.status(400).json({message:"A valid email and password are required"});
  const user=await User.findOne({email:req.body.email.trim().toLowerCase()}).select("+password");
  if(!user||!(await bcrypt.compare(req.body.password,user.password))) return res.status(401).json({message:"Invalid credentials"});
  const token=jwt.sign({id:user._id},process.env.JWT_SECRET,{expiresIn:"7d"});
  res.json({token,user:{id:user._id,name:user.name,email:user.email,role:user.role}});
 }catch(e){next(e)}
});
export default r;
