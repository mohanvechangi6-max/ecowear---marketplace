const conditionScores={new:95,excellent:88,good:76,fair:62,poor:45};

const demoGrader=async(listing)=>{
 const conditionScore=conditionScores[listing.condition]||70;
 const authenticityScore=listing.brand?Math.min(98,82+(listing.brand.length%15)):72;

 return {
  conditionScore,
  authenticityScore,
  conditionLabel:listing.condition||"unknown",
  authenticityLabel:authenticityScore>=85?"Likely authentic":"Needs review",
  confidence:.86,
  notes:"Deterministic demo grade. Replace this service with a production image/vision model."
 };
};

const graders=new Map([["demo",demoGrader]]);

export function registerAIGrader(name,grader){
 if(typeof name!=="string"||!name.trim()||typeof grader!=="function") throw new TypeError("An AI grader name and function are required");
 graders.set(name.trim(),grader);
}

export async function gradeListing(listing){
 const provider=process.env.AI_GRADER_PROVIDER||"demo";
 const grader=graders.get(provider);
 if(!grader) throw new Error(`AI grader provider '${provider}' is not registered`);
 return grader(listing);
}
