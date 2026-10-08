import jwt from "jsonwebtoken";
import User from "../models/User.js";

export async function auth(req,res,next){
  const authorization=req.headers.authorization||"";
  if(!authorization.startsWith("Bearer ")) return res.status(401).json({message:"Authentication required"});
  let decoded;
  try{
    decoded=jwt.verify(authorization.slice(7),process.env.JWT_SECRET);
  }catch(e){
    if(e instanceof jwt.JsonWebTokenError||e instanceof jwt.TokenExpiredError) return res.status(401).json({message:"Invalid or expired token"});
    return next(e);
  }
  try{
    req.user=await User.findById(decoded.id).select("-password");
    if(!req.user) return res.status(401).json({message:"User not found"});
    next();
  }catch(e){next(e);}
}
export function roles(...allowed){
  return (req,res,next)=>allowed.includes(req.user?.role) ? next() : res.status(403).json({message:"Forbidden"});
}
export async function optionalAuth(req,res,next){
  const authorization=req.headers.authorization;
  if(!authorization) return next();
  if(!authorization.startsWith("Bearer ")) return res.status(401).json({message:"Invalid authorization header"});
  let decoded;
  try{
    decoded=jwt.verify(authorization.slice(7),process.env.JWT_SECRET);
  }catch(e){
    if(e instanceof jwt.JsonWebTokenError||e instanceof jwt.TokenExpiredError) return res.status(401).json({message:"Invalid or expired token"});
    return next(e);
  }
  try{
    req.user=await User.findById(decoded.id).select("-password");
    if(!req.user) return res.status(401).json({message:"User not found"});
    next();
  }catch(e){
    next(e);
  }
}
