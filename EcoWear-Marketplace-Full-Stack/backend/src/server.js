import express from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import mongoose from "mongoose";
import authRoutes from "./routes/auth.js";
import apiRoutes from "./routes/api.js";

dotenv.config();
const isProduction=process.env.NODE_ENV==="production";
if(typeof process.env.JWT_SECRET!=="string"||process.env.JWT_SECRET.length<32){
 throw new Error("JWT_SECRET must be configured with at least 32 characters");
}
if(isProduction&&(!process.env.MONGODB_URI||!process.env.CLIENT_URL)){
 throw new Error("MONGODB_URI and CLIENT_URL must be configured in production");
}
const configuredOrigins=(process.env.CLIENT_URL||"http://localhost:5173,http://127.0.0.1:5173").split(",").map((value)=>{
 const origin=value.trim();
 let parsed;
 try{parsed=new URL(origin);}catch{throw new Error(`Invalid CLIENT_URL origin: ${origin}`);}
 if(!["http:","https:"].includes(parsed.protocol)||parsed.pathname!=="/"||parsed.search||parsed.hash||parsed.origin!==origin.replace(/\/$/,"")){
  throw new Error(`CLIENT_URL must contain exact HTTP(S) origins: ${origin}`);
 }
 return parsed.origin;
});
// Allow standard Vite loopback hostnames in development.
const allowedOrigins=[...new Set([...configuredOrigins,...(!isProduction?["http://localhost:5173","http://127.0.0.1:5173"]:[])])];
const app = express();
app.use(cors({origin:(origin,callback)=>callback(null,!origin||allowedOrigins.includes(origin))}));
app.use(express.json({limit:"2mb"}));
app.use(morgan("dev"));

app.get("/api/health",(req,res)=>res.json({ok:true,service:"EcoWear API"}));
app.use("/api/auth", authRoutes);
app.use("/api", apiRoutes);

app.use((err,req,res,next)=>{
  console.error(err);
  if(res.headersSent) return next(err);
  const status=err.status||500;
  const message=status===400?"Invalid request body":status===413?"Request body is too large":status<500?err.message:"Server error";
  res.status(status).json({message});
});

const port=process.env.PORT||5000;
mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ecowear")
.then(()=>app.listen(port,()=>console.log(`EcoWear API running on ${port}`)))
.catch(e=>{console.error("MongoDB connection failed:",e.message); process.exit(1);});
