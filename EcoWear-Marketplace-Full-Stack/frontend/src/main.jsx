import React,{useEffect,useState} from "react";
import {createRoot} from "react-dom/client";
import {BrowserRouter,useNavigate,useLocation,Link,Routes,Route,Navigate} from "react-router-dom";
import "./styles.css";

const API=import.meta.env.VITE_API_URL||"http://localhost:5000/api";

function getStoredUser(){
  try { return JSON.parse(localStorage.getItem("user")||"null"); }
  catch { return null; }
}

async function api(path,opts={}){
  const token=localStorage.getItem("token");
  const res=await fetch(API+path,{...opts,headers:{"Content-Type":"application/json",...(opts.headers||{}),...(token?{Authorization:"Bearer "+token}:{})}});
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw Error(data.message||"Request failed");
  return data;
}

function getCart(){
  try { return JSON.parse(localStorage.getItem("cart")||"[]"); }
  catch { return []; }
}

function addToCart(item){
  const cart=getCart();
  const existing=cart.find((it)=>it._id===item._id);
  if(existing){ existing.quantity=1; }
  else { cart.push({...item, quantity:1}); }
  localStorage.setItem("cart",JSON.stringify(cart));
  return cart.reduce((sum,it)=>sum+it.quantity,0);
}

function removeFromCart(id){
  const cart=getCart().filter((it)=>it._id!==id);
  localStorage.setItem("cart",JSON.stringify(cart));
  return cart;
}

function listingImpact(listing){
  if(listing.impact) return listing.impact;
  const price=Number(listing.price)||0;
  return {
    waterSaved:Math.round(2700+price*2),
    co2Saved:Number((8+price/100).toFixed(2)),
    score:Math.round(50+Math.min(price,500)/10)
  };
}

function Layout({children}){
  const nav=useNavigate();
  const user=getStoredUser();
  const cartCount=getCart().reduce((sum,item)=>sum+item.quantity,0);

  function logout(){
    localStorage.clear();
    nav("/login");
  }

  return <><header><Link className="brand" to="/">EcoWear<span aria-hidden="true">●</span></Link><nav aria-label="Primary navigation"><Link to="/browse">Shop</Link><Link to="/repairs">Repairs</Link><Link to="/auctions">Auctions</Link><Link to="/sell">Sell</Link><Link to="/impact">Impact</Link><Link to="/cart">Cart ({cartCount})</Link>{user?<><Link to="/orders">Orders</Link><Link to="/messages">Messages</Link>{user.role==="seller"&&<Link to="/seller">Seller</Link>}{user.role==="repair_partner"&&<Link to="/repair-partner">Partner</Link>}{user.role==="admin"&&<Link to="/admin">Admin</Link>}<button onClick={logout}>Logout</button></>:<Link className="btn" to="/login">Login</Link>}</nav></header><main>{children}</main><footer>EcoWear · Buy better. Repair more. Waste less.</footer></>;
}

function Home(){
  const fallbackImages=[
    "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=480&q=80",
    "https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=480&q=80",
    "https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=480&q=80",
    "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=480&q=80"
  ];
  const boards=[
    {slug:"european-summer",title:"European summer",note:"LINEN · LEATHER · LATE CHECKOUT",mood:"Sun-faded layers for somewhere new",color:"board-olive"},
    {slug:"italian-wedding",title:"Italian wedding ideas",note:"GUEST LOOKS · SOFT TAILORING",mood:"A little dressed up, a lot re-wearable",color:"board-rose"},
    {slug:"everyday-uniform",title:"The everyday uniform",note:"DENIM · COTTON · FOREVER PIECES",mood:"Good basics, better second chapters",color:"board-blue"}
  ];
  const [pieces,setPieces]=useState([]),[error,setError]=useState(""),[notice,setNotice]=useState(""),[selectedBoard,setSelectedBoard]=useState(null),[shareOpen,setShareOpen]=useState(false),[shareStatus,setShareStatus]=useState(""),[shareLink,setShareLink]=useState("");
  useEffect(()=>{
    let active=true;
    api("/search?sort=newest").then(async(results)=>{
      if(!active)return;
      setPieces(results);
      const params=new URLSearchParams(window.location.search);
      const slug=params.get("style");
      const ids=(params.get("items")||"").split(",").filter(Boolean).slice(0,12);
      if(slug){
        const definition=boards.find((board)=>board.slug===slug);
        if(definition){
          const shared=results.filter((item)=>ids.includes(item._id));
          setSelectedBoard({...definition,items:shared.length?shared:fallbackImages.map((image,slot)=>({image,title:`A considered piece ${slot+1}`,preview:true})),shared:true});
        }
      }
    })
      .catch((e)=>{if(active)setError(e.message);});
    return ()=>{active=false;};
  },[]);
  function addPiece(piece){
    addToCart(piece);
    setNotice(`${piece.title} added to your bag`);
    window.setTimeout(()=>setNotice(""),2800);
  }
  function shareBoard(){
    setShareStatus("");
    const shareUrl=new URL(window.location.href);
    shareUrl.search="";
    shareUrl.searchParams.set("style",selectedBoard.slug);
    shareUrl.searchParams.set("items",(selectedBoard.items||[]).map((piece)=>piece._id).filter(Boolean).join(","));
    setShareLink(shareUrl.toString());
    setShareOpen(true);
  }
  async function copyBoardLink(){
    try{
      if(!navigator.clipboard?.writeText) throw new Error("Clipboard access is unavailable. Select the link below and copy it.");
      await navigator.clipboard.writeText(shareLink);
      setShareStatus("Link copied. Your friends can view this board.");
    }catch(e){
      setShareStatus(e.message||"Could not copy the board link. Select it below and copy it.");
    }
  }
  function boardPieces(index){
    if(!pieces.length)return fallbackImages.map((image,slot)=>({image,title:`A considered piece ${slot+1}`,preview:true}));
    const start=(index*2)%pieces.length;
    return Array.from({length:Math.min(4,pieces.length)},(_,slot)=>pieces[(start+slot)%pieces.length]);
  }
  return <div className="shop-home">
    <section className="shop-hero">
      <div className="nova-stage" aria-hidden="true">
        <img className="nova-stage-image" src="https://www.propertyfinder.ae/blog/wp-content/uploads/2024/04/5-7.jpg" alt="A man browsing a clothing rack in a warmly lit fashion store"/>
        <div className="nova-stage-wash"/>
        <p className="nova-stage-caption"><span>ECOWEAR STUDIO</span><b>ANOTHER LIFE, WELL WORN.</b></p>
      </div>
      <div className="nova-center">
        <p className="nova-kicker"><span/>PRE-LOVED. FOREVER RELEVANT.</p>
        <h1>Wear the past.<br/><em>Shape what’s next.</em></h1>
        <p className="nova-intro">A considered wardrobe, collected one-of-a-kind piece at a time. Discover the beauty in wearing things differently.</p>
        <div className="nova-actions">
          <Link className="nova-shop-link" to="/browse">Shop the collection <span>↗</span></Link>
          <button className="nova-board-link" type="button" onClick={()=>setSelectedBoard({...boards[0],items:boardPieces(0)})}>Explore the edit <span>↗</span></button>
        </div>
        <div className="nova-impact-note"><span>01 / 03</span><i/><span>BETTER FINDS. LIGHTER FOOTPRINT.</span></div>
      </div>
      {error&&<p className="nova-error" role="alert">The latest collection could not be loaded. You can still browse the store.</p>}
      <div className="nova-bottomline"><span>CURATED WITH CARE <i>·</i> MADE TO GO AROUND</span><span>GOOD STYLE, LESS IMPACT <b>↗</b></span></div>
      {notice&&<p className="nova-notice" role="status">{notice}</p>}
    </section>

    {selectedBoard&&<div className="styleboard-overlay" role="presentation" onClick={()=>{setSelectedBoard(null);setShareOpen(false);setShareStatus("");}}><section className="styleboard-dialog" role="dialog" aria-modal="true" aria-hidden={shareOpen||undefined} aria-labelledby="active-board-title" onClick={(event)=>event.stopPropagation()}>
      <button className="styleboard-close" type="button" aria-label="Close style board" onClick={()=>{setSelectedBoard(null);setShareOpen(false);setShareStatus("");}}>×</button>
      <p className="styleboard-eyebrow"><span/>{selectedBoard.shared?"SHARED STYLE BOARD · VIEW ONLY":"COMMUNITY STYLE BOARD"}</p><h2 id="active-board-title">{selectedBoard.title}</h2><p className="board-dialog-subtitle">{selectedBoard.mood||"A considered edit from the EcoWear closet."}</p>
      <div className="board-dialog-grid">{(selectedBoard.items||[]).map((item,index)=><article className="board-dialog-item" key={item._id||index}>
        {item._id?<Link to={`/product/${item._id}`} className="board-dialog-image"><img src={item.images?.[0]||fallbackImages[index%fallbackImages.length]} alt={item.title}/></Link>:<div className="board-dialog-image"><img src={item.image||fallbackImages[index%fallbackImages.length]} alt="Curated fashion inspiration"/></div>}
        <div><span>{item.brand||item.category||"THE SECOND-LIFE EDIT"}</span><h3>{item.title}</h3>{item._id&&<div className="dialog-item-actions"><b>₹{Number(item.price||0).toLocaleString("en-IN")}</b><button type="button" onClick={()=>addPiece(item)}>Add to bag +</button></div>}</div>
      </article>)}</div>
      <div className="board-dialog-footer"><p>Friends can view this board. They won't be able to edit it.</p><button type="button" className="styleboard-share" onClick={()=>shareBoard(selectedBoard)}>Share this board <span>↗</span></button></div>
      {shareStatus&&<p className="share-result" role="status">{shareStatus}</p>}
      {selectedBoard.shared&&<p className="shared-readonly">You're viewing a shared board. Its original owner keeps the edit controls.</p>}
      <Link className="styleboard-browse-link" to="/browse">Browse every piece <span>↗</span></Link>
    </section></div>}
    {selectedBoard&&shareOpen&&<div className="styleboard-overlay styleboard-share-overlay" role="presentation" onClick={()=>setShareOpen(false)}><section className="styleboard-share-dialog" role="dialog" aria-modal="true" aria-labelledby="share-board-title" onClick={(event)=>event.stopPropagation()}>
      <button className="styleboard-close" type="button" aria-label="Close sharing information" onClick={()=>setShareOpen(false)}>×</button>
      <div className="share-board-art" aria-hidden="true">{(selectedBoard.items||[]).slice(0,4).map((item,index)=><img key={item._id||index} src={item.images?.[0]||item.image||fallbackImages[index%fallbackImages.length]} alt=""/>)}</div>
      <p className="styleboard-eyebrow"><span/>GOOD FINDS ARE BETTER SHARED</p>
      <h2 id="share-board-title">Share this style board with your friends</h2>
      <p>Friends can view the pieces in this board, but they won't be able to edit your selection.</p>
      <label className="share-link-label">BOARD LINK<input aria-label="Style board share link" readOnly value={shareLink} onFocus={(event)=>event.target.select()}/></label>
      <button className="styleboard-share share-copy" type="button" onClick={copyBoardLink}>Copy link <span aria-hidden="true">↗</span></button>
      {shareStatus&&<p className="share-result" role="alert">{shareStatus}</p>}
      <button className="styleboard-share share-got-it" type="button" onClick={()=>setShareOpen(false)}>Got it</button>
    </section></div>}
  </div>;
}

function Browse(){
  const [items,setItems]=useState([]),[filters,setFilters]=useState(null),[filterError,setFilterError]=useState(""),[error,setError]=useState(""),[loading,setLoading]=useState(true);
  const [collectionOpen,setCollectionOpen]=useState(false);
  const [query,setQuery]=useState(()=>{
    const params=new URLSearchParams(window.location.search);
    return {q:params.get("q")||"",category:params.get("category")||"",brand:"",location:"",condition:"",size:"",color:"",material:"",minPrice:"",maxPrice:"",sort:"newest"};
  });
  useEffect(()=>{
    let active=true;
    api("/filters").then((data)=>{if(active){setFilters(data);setFilterError("");}})
      .catch((e)=>{if(active)setFilterError(e.message);});
    return ()=>{active=false;};
  },[]);
  useEffect(()=>{
    if(!collectionOpen)return;
    function closeOnEscape(event){if(event.key==="Escape")setCollectionOpen(false);}
    window.addEventListener("keydown",closeOnEscape);
    return ()=>window.removeEventListener("keydown",closeOnEscape);
  },[collectionOpen]);
  useEffect(()=>{
    let active=true;
    const params=new URLSearchParams();
    for(const [key,value] of Object.entries(query)) if(value) params.set(key,value);
    setLoading(true);
    api("/search?"+params.toString()).then((data)=>{if(active){setItems(data);setError("");}})
      .catch((e)=>{if(active)setError(e.message);})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[query]);
  function update(key,value){ setQuery((current)=>({...current,[key]:value})); }
  const activeFilterCount=Object.entries(query).filter(([key,value])=>key!=="sort"&&Boolean(value)).length;
  function clearFilters(){
    setQuery({q:"",category:"",brand:"",location:"",condition:"",size:"",color:"",material:"",minPrice:"",maxPrice:"",sort:"newest"});
  }
  function selectFilter(label,key,values){
    const suggestions={
      category:["T-shirts","Shirts","Jeans"],
      brand:["Adidas","H&M","Levi's","Nike","Puma","Uniqlo","Zara"],
      location:["Visakhapatnam"],
      size:["S","M","XL","XXL","XXXL"],
      color:["Beige","Black","Blue","Brown","Burgundy","Cream","Green","Grey","Maroon","Navy","Olive","Orange","Pink","Purple","Red","Sage","White","Yellow"],
      material:["Cotton","Denim","Hemp","Linen","Nylon","Organic cotton","Polyester","Recycled polyester","Silk","Wool"]
    };
    const options=[...new Set([...(values||[]),...(suggestions[key]||[])])].sort((a,b)=>a.localeCompare(b));
    return <label className="filter-control">{label}<select value={query[key]} onChange={(event)=>update(key,event.target.value)}><option value="">All</option>{options.map((value)=><option key={value} value={value}>{value}</option>)}</select></label>;
  }
  function collectionFilters(){
    return <>
      {selectFilter("Category","category",filters?.categories)}
      {selectFilter("Brand","brand",filters?.brands)}
      {selectFilter("Location","location",filters?.locations)}
      {selectFilter("Condition","condition",filters?.conditions||["new","excellent","good","fair","poor"])}
      {selectFilter("Size","size",filters?.sizes)}
      {selectFilter("Color","color",filters?.colors)}
      {selectFilter("Material","material",filters?.materials)}
      <label className="filter-control">Min price<input type="number" min="0" value={query.minPrice} onChange={(e)=>update("minPrice",e.target.value)} /></label>
      <label className="filter-control">Max price<input type="number" min="0" value={query.maxPrice} onChange={(e)=>update("maxPrice",e.target.value)} /></label>
      <label className="filter-control">Sort by<select value={query.sort} onChange={(e)=>update("sort",e.target.value)}><option value="newest">Newest</option><option value="price_asc">Price: low to high</option><option value="price_desc">Price: high to low</option></select></label>
    </>;
  }
  const coverPieces=items.length?items.slice(0,3):query.q?[]:[
    {title:"A familiar favorite",brand:"THE SECOND LIFE EDIT",image:"https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=520&q=80"},
    {title:"The well-loved leather layer",brand:"ONE OF A KIND",image:"https://images.unsplash.com/photo-1551028719-00167b16eac5?auto=format&fit=crop&w=520&q=80"},
    {title:"The everyday essential",brand:"MADE TO GO AROUND",image:"https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=520&q=80"}
  ];
  return <div className="browse-experience">
    <section className="browse-cover" aria-labelledby="browse-cover-title">
      <div className="browse-cover-sun" aria-hidden="true"/>
      <div className="browse-cover-orbit" aria-hidden="true"/>
      <img className="browse-cover-image" src="https://www.propertyfinder.ae/blog/wp-content/uploads/2024/04/5-7.jpg" alt="A shopper browsing clothes in a warm, softly lit boutique"/>
      <div className="browse-cover-copy">
        <p className="browse-cover-kicker"><span/>A GOOD FIND HAS A SECOND STORY</p>
        <h1 id="browse-cover-title">Your next<br/>favorite is<br/><em>out there.</em></h1>
        <p className="browse-cover-intro">One-of-a-kind pieces, ready for their next chapter. Discover a wardrobe with a lighter footprint.</p>
        <form className="browse-cover-search" onSubmit={(event)=>{event.preventDefault();setCollectionOpen(true);}}>
          <span aria-hidden="true">⌕</span>
          <input aria-label="Search listings" placeholder="Try denim, linen, vintage…" value={query.q} onChange={(e)=>update("q",e.target.value)}/>
          <button type="submit" aria-label="Search listings">↗</button>
        </form>
        <div className="browse-cover-actions">
          <button className="browse-cover-cta" type="button" onClick={()=>setCollectionOpen(true)}>Explore the collection <span>↗</span></button>
          <button className="browse-filter-trigger" type="button" onClick={()=>setCollectionOpen(true)} aria-label={`Open filters${activeFilterCount?`, ${activeFilterCount} active`:""}`}>
            <span aria-hidden="true">☷</span> Filters{activeFilterCount>0&&<b>{activeFilterCount}</b>}
          </button>
        </div>
      </div>
      {(filterError||error)&&<p className="browse-cover-error" role="alert">{filterError||error}</p>}
      <div className="browse-cover-cards" aria-label="A few pieces from the collection">
        {coverPieces.map((piece,index)=><Link className={`browse-cover-card browse-cover-card-${index+1}`} key={piece._id||piece.title} to={piece._id?`/product/${piece._id}`:"#"} onClick={(event)=>{if(!piece._id){event.preventDefault();setCollectionOpen(true);}}}>
          <img src={piece.images?.[0]||piece.image} alt={piece.title}/>
          <span><small>{piece.brand||"THE SECOND LIFE EDIT"}</small><b>{piece.title}</b></span>
        </Link>)}
        {!coverPieces.length&&<p className="browse-cover-no-results">No pieces match “{query.q}” yet.<br/>Try another search.</p>}
      </div>
      <p className="browse-cover-note"><span>{loading?"…":`${items.length} ${items.length===1?"PIECE":"PIECES"}`}</span> GOOD STYLE, PASSED FORWARD</p>
    </section>
    {collectionOpen&&<div className="browse-collection-backdrop" role="presentation" onClick={()=>setCollectionOpen(false)}>
    <section className="browse-catalog page" id="browse-results" role="dialog" aria-modal="true" aria-labelledby="browse-results-title" onClick={(event)=>event.stopPropagation()}>
      <button className="browse-collection-close" type="button" aria-label="Close collection" onClick={()=>setCollectionOpen(false)}>×</button>
      <div className="pagehead"><div><p className="eyebrow">CURATED CIRCULAR WARDROBE</p><h2 id="browse-results-title">The collection</h2></div><p className="browse-result-count">{loading?"Finding good things…":`${items.length} ${items.length===1?"piece":"pieces"} to discover`}</p></div>
      <div className="browse-filter-heading"><p>REFINE YOUR FIND</p><button type="button" onClick={clearFilters} disabled={!activeFilterCount&&query.sort==="newest"}>Clear all</button></div>
      <div className="search-filters">{collectionFilters()}</div>
      {(filterError||error)&&<p className="form-error" role="alert">{filterError||error}</p>}
      {loading?<p className="loading-state" role="status">Loading listings…</p>:<><div className="grid">{items.map((x)=><Product key={x._id} x={x}/>)}</div>{!items.length&&!error&&<div className="empty">{activeFilterCount?"No listings match those filters.":"No active listings are available yet. Check back soon or explore another category."}</div>}</>}
      <footer className="browse-collection-footer"><button className="primary" type="button" onClick={()=>setCollectionOpen(false)}>Submit</button></footer>
    </section></div>}
  </div>;
}

function Product({x}){
  const impact=listingImpact(x);
  return <Link to={"/product/"+x._id} className="product">
    <div className="pic">{x.images?.[0]?<img src={x.images[0]} alt={x.title}/>:<span>EW</span>}<span className="status-badge">{x.status||"active"}</span></div>
    <div className="productbody">
      <small>{x.brand||"Independent"} · {x.condition||"Condition not specified"}</small>
      <h3>{x.title}</h3>
      <div className="row"><b>₹{x.price||0}</b><span>💧 {impact.waterSaved}L saved</span></div>
      <p className="product-seller">Sold by {x.seller?.name||"EcoWear seller"}</p>
    </div>
  </Link>;
}

function ProductPage({id}){
  const navigate=useNavigate();
  const [x,setX]=useState(null),[error,setError]=useState(""),[loading,setLoading]=useState(true);
  const [reviewData,setReviewData]=useState({reviews:[],total:0,averageRating:null});
  const [reviewRating,setReviewRating]=useState("5"),[reviewComment,setReviewComment]=useState("");
  const [editingReview,setEditingReview]=useState(null),[reviewError,setReviewError]=useState("");
  const [reportOpen,setReportOpen]=useState(false),[reportReason,setReportReason]=useState("Misleading listing"),[reportDetails,setReportDetails]=useState("");
  const [reportMessage,setReportMessage]=useState(""),[reportError,setReportError]=useState("");
  const user=getStoredUser();
  useEffect(()=>{
    let active=true;
    setLoading(true);setError("");setX(null);
    api("/listings/"+id).then((listing)=>{if(active)setX(listing);})
      .catch((e)=>{if(active)setError(e.message);})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[id]);
  async function loadReviews(){
    try{setReviewData(await api("/reviews/listing/"+id));setReviewError("");}
    catch(e){setReviewError(e.message);}
  }
  useEffect(()=>{loadReviews();},[id]);
  if(loading) return <section className="page"><p className="loading-state" role="status">Loading product…</p></section>;
  if(error) return <section className="page"><div className="form-error" role="alert">{error}</div></section>;
  if(!x) return null;
  const impact=listingImpact(x);
  const ai=x.aiGrade||{};

  function handleAdd(){
    const count=addToCart(x);
    alert(`${x.title} added to cart (${count} item${count===1?"":"s"})`);
  }

  async function messageSeller(){
    try{
      const conversation=await api("/conversations",{method:"POST",body:JSON.stringify({listingId:id})});
      navigate(`/messages/${conversation._id}`);
    }catch(e){setError(e.message);}
  }

  async function submitListingReport(event){
    event.preventDefault();
    setReportMessage("");
    setReportError("");
    try{
      await api("/admin/reports",{method:"POST",body:JSON.stringify({targetType:"listing",targetId:id,reason:reportReason,details:reportDetails})});
      setReportMessage("Report submitted for review.");
      setReportDetails("");
      setReportOpen(false);
    }catch(e){setReportError(e.message);}
  }

  async function submitReview(event){
    event.preventDefault();
    setReviewError("");
    const payload={rating:Number(reviewRating),comment:reviewComment};
    try{
      await api(editingReview?`/reviews/${editingReview._id}`:"/reviews",{
        method:editingReview?"PUT":"POST",
        body:JSON.stringify(editingReview?payload:{...payload,listing:id})
      });
      setReviewComment("");
      setReviewRating("5");
      setEditingReview(null);
      await loadReviews();
    }catch(e){setReviewError(e.message);}
  }
  async function removeReview(review){
    setReviewError("");
    try{await api(`/reviews/${review._id}`,{method:"DELETE"});await loadReviews();}
    catch(e){setReviewError(e.message);}
  }

  return <section className="detail page">
    <div className="detail-gallery">
      <div className="detailpic">{x.images?.[0]?<img src={x.images[0]} alt={x.title}/>:<span>EW</span>}<span className="status-badge">{x.status||"active"}</span></div>
      {x.images?.length>1&&<div className="image-thumbnails">{x.images.slice(1).map((image,index)=><img key={`${image}-${index}`} src={image} alt={`${x.title} photo ${index+2}`}/>)}</div>}
    </div>
    <div className="product-details">
      <p className="eyebrow">{x.brand||"Independent"} · {x.category||"Uncategorized"}</p>
      <h2>{x.title}</h2>
      <p>{x.description||"No description provided."}</p>
      <h2>₹{x.price??"—"}</h2>
      <p className="seller-line">Sold by <strong>{x.seller?.name||"EcoWear seller"}</strong>{x.seller?.role?` · ${x.seller.role}`:""}</p>
      <h3>Item details</h3>
      <dl className="product-attributes">
        <div><dt>Condition</dt><dd>{x.condition||"Not specified"}</dd></div>
        <div><dt>Location</dt><dd>{x.location||"Not specified"}</dd></div>
        <div><dt>Size</dt><dd>{x.size||"Not specified"}</dd></div>
        <div><dt>Color</dt><dd>{x.color||"Not specified"}</dd></div>
        <div><dt>Material</dt><dd>{x.material||"Not specified"}</dd></div>
        <div><dt>Listing status</dt><dd>{x.status||"active"}</dd></div>
      </dl>
      <h3>AI & sustainability</h3>
      <div className="metrics product-metrics">
        <div><b>{ai.authenticityScore??"Not graded"}{ai.authenticityScore!=null?"%":""}</b><small>AI authenticity</small></div>
        <div><b>{ai.conditionScore??"Not graded"}{ai.conditionScore!=null?"%":""}</b><small>AI condition</small></div>
        <div><b>{impact.score}</b><small>Sustainability impact score</small></div>
        <div><b>{impact.waterSaved.toLocaleString()}L</b><small>Estimated water saved</small></div>
        <div><b>{impact.co2Saved}kg</b><small>Estimated CO₂e saved</small></div>
      </div>
      <div className="action-row"><button className="primary" onClick={handleAdd}>Add to cart</button><Link className="secondary" to="/repair-booking">Book repair</Link>{user?.role==="buyer"&&<button className="secondary" onClick={messageSeller}>Message seller</button>}{user&&user.role!=="admin"&&<button className="secondary" onClick={()=>setReportOpen((open)=>!open)}>Report listing</button>}</div>
      {reportMessage&&<p className="success-message" role="status">{reportMessage}</p>}{reportError&&<p className="form-error" role="alert">{reportError}</p>}
      {reportOpen&&<form className="report-form" onSubmit={submitListingReport}>
        <label>Reason<select value={reportReason} onChange={(event)=>setReportReason(event.target.value)}><option>Misleading listing</option><option>Counterfeit concern</option><option>Prohibited item</option><option>Other</option></select></label>
        <label>Details<textarea maxLength="2000" value={reportDetails} onChange={(event)=>setReportDetails(event.target.value)} placeholder="Add relevant context"/></label>
        <button className="primary" type="submit">Submit report</button>
      </form>}
    </div>
    <section className="listing-reviews">
      <p className="eyebrow">BUYER FEEDBACK</p>
      <h3>Reviews {reviewData.averageRating!=null&&<span className="rating-summary">★ {reviewData.averageRating} · {reviewData.total}</span>}</h3>
      {reviewError&&<p className="form-error" role="alert">{reviewError}</p>}
      {user?.role==="buyer"&&<form className="review-form" onSubmit={submitReview}>
        <label>Rating<select value={reviewRating} onChange={(e)=>setReviewRating(e.target.value)}><option value="5">5 — Excellent</option><option value="4">4 — Good</option><option value="3">3 — Average</option><option value="2">2 — Poor</option><option value="1">1 — Very poor</option></select></label>
        <label>Comment<textarea required maxLength="2000" value={reviewComment} onChange={(e)=>setReviewComment(e.target.value)} placeholder="Share your experience after your order has been delivered."/></label>
        <button className="primary" type="submit">{editingReview?"Update review":"Submit a review"}</button>
        {editingReview&&<button type="button" className="secondary" onClick={()=>{setEditingReview(null);setReviewComment("");}}>Stop editing</button>}
      </form>}
      <div className="reviews-list">{reviewData.reviews.map((review)=><article className="review-card" key={review._id}>
        <div className="review-card-heading"><strong>{review.author?.name||"Buyer"}</strong><span>{"★".repeat(review.rating)}{"☆".repeat(5-review.rating)}</span></div>
        <p>{review.comment}</p><small>{new Date(review.createdAt).toLocaleDateString()}</small>
        {(user?.role==="admin"||user?.id===review.author?._id)&&<div className="action-row">
          {user?.role!=="admin"&&<button className="secondary" onClick={()=>{setEditingReview(review);setReviewRating(String(review.rating));setReviewComment(review.comment);}}>Edit</button>}
          <button className="secondary" onClick={()=>removeReview(review)}>Delete</button>
        </div>}
      </article>)}
      {!reviewData.reviews.length&&<p className="empty">No reviews yet.</p>}</div>
    </section>
  </section>;
}

function Auth({register=false}){
  const nav=useNavigate();
  const [f,setF]=useState({name:"",email:"",password:"",role:"buyer"});
  const [error,setError]=useState(""),[saving,setSaving]=useState(false);

  async function submit(e){
    e.preventDefault();
    setError("");setSaving(true);
    try{
      const payload=register?f:{email:f.email,password:f.password};
      const d=await api(register?"/auth/register":"/auth/login",{method:"POST",body:JSON.stringify(payload)});
      localStorage.setItem("token",d.token);
      localStorage.setItem("user",JSON.stringify(d.user));
      nav("/");
    }
    catch(e){ setError(e.message); }
    finally{setSaving(false);}
  }

  return <section className={`auth auth-page${register?" auth-register":""}`}>
    <video className="auth-background-video" autoPlay loop muted playsInline aria-hidden="true" tabIndex={-1}>
      <source src="https://cdn.dribbble.com/userupload/48663969/file/1e2fe921eabbd6b337f9e457f2005f2e.mp4" type="video/mp4"/>
    </video>
    <div className="auth-panel">
      <div className="auth-form-wrap">
        <Link className="auth-brand" to="/">ECOWEAR<span>®</span></Link>
        <p className="auth-eyebrow">{register?"BECOME A MEMBER":"WELCOME BACK"}</p>
        <h2>{register?"Create your account":"Sign in to EcoWear"}</h2>
        <p className="auth-subtitle">{register?"A wardrobe with a little more meaning starts here.":"Your considered wardrobe is just a moment away."}</p>
        {error&&<p className="form-error" role="alert">{error}</p>}
        <form onSubmit={submit}>
          {register&&<label className="auth-field">Full name<input autoComplete="name" name="name" placeholder="Your name" required value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></label>}
          <label className="auth-field">Email address<input autoComplete="email" name="email" placeholder="you@example.com" type="email" required value={f.email} onChange={e=>setF({...f,email:e.target.value})}/></label>
          <label className="auth-field">Password<input autoComplete={register?"new-password":"current-password"} name="password" placeholder="Enter your password" type="password" required value={f.password} onChange={e=>setF({...f,password:e.target.value})}/></label>
          {register&&<label className="auth-field">I’m here to<select aria-label="Account role" value={f.role} onChange={e=>setF({...f,role:e.target.value})}><option value="buyer">Shop pre-loved fashion</option><option value="seller">Sell my pre-loved pieces</option><option value="repair_partner">Offer repair services</option></select></label>}
          {!register&&<div className="auth-form-meta"><span>Thoughtful style, always in season.</span><span>SECURE SIGN IN</span></div>}
          <button className="auth-submit" type="submit" disabled={saving}>{saving?"Please wait…":register?"Create account":"Sign in"}<span aria-hidden="true">↗</span></button>
        </form>
        <p className="auth-switch">{register?"Already have an account?":"New to EcoWear?"} <Link to={register?"/login":"/register"}>{register?"Sign in":"Create an account"} <span aria-hidden="true">↗</span></Link></p>
        <p className="auth-terms">By continuing, you agree to our community guidelines and terms of service.</p>
      </div>
    </div>
  </section>;
}

function Sell(){
  const [f,setF]=useState({title:"",price:"",category:"",brand:"",location:"",size:"",color:"",material:"",condition:"good",description:"",images:""});
  const [error,setError]=useState(""),[notice,setNotice]=useState(""),[saving,setSaving]=useState(false);

  async function submit(e){
    e.preventDefault();
    setError("");setNotice("");setSaving(true);
    try {
      const images=f.images.split(/\r?\n|,/).map((url)=>url.trim()).filter(Boolean);
      await api("/listings",{method:"POST",body:JSON.stringify({...f,images,price:Number(f.price)})});
      setF({title:"",price:"",category:"",brand:"",location:"",size:"",color:"",material:"",condition:"good",description:"",images:""});
      setNotice("Listing published successfully.");
    }
    catch(e){ setError(e.message); }
    finally{setSaving(false);}
  }

  return <section className="formpage page"><h2>List a piece</h2><p>Give a quality garment its next life.</p>{error&&<p className="form-error" role="alert">{error}</p>}{notice&&<p className="success-message" role="status">{notice}</p>}<form onSubmit={submit}>
    <label>Title<input required value={f.title} onChange={(e)=>setF({...f,title:e.target.value})}/></label>
    <label>Brand<input list="listing-brands" value={f.brand} onChange={(e)=>setF({...f,brand:e.target.value})}/><datalist id="listing-brands">{["Adidas","H&M","Levi's","Nike","Puma","Uniqlo","Zara"].map((brand)=><option key={brand} value={brand}/>)}</datalist></label>
    <label>Location<input list="listing-locations" maxLength="120" value={f.location} onChange={(e)=>setF({...f,location:e.target.value})} placeholder="City or region"/><datalist id="listing-locations"><option value="Visakhapatnam"/></datalist></label>
    <label>Category<input required list="listing-categories" value={f.category} onChange={(e)=>setF({...f,category:e.target.value})}/><datalist id="listing-categories">{["T-shirts","Shirts","Jeans"].map((category)=><option key={category} value={category}/>)}</datalist></label>
    <label>Price (₹)<input required type="number" min="0" step="0.01" value={f.price} onChange={(e)=>setF({...f,price:e.target.value})}/></label>
    <label>Size<input list="listing-sizes" value={f.size} onChange={(e)=>setF({...f,size:e.target.value})}/><datalist id="listing-sizes">{["S","M","XL","XXL","XXXL"].map((size)=><option key={size} value={size}/>)}</datalist></label>
    <label>Color<input list="listing-colors" value={f.color} onChange={(e)=>setF({...f,color:e.target.value})}/><datalist id="listing-colors">{["Beige","Black","Blue","Brown","Burgundy","Cream","Green","Grey","Maroon","Navy","Olive","Orange","Pink","Purple","Red","Sage","White","Yellow"].map((color)=><option key={color} value={color}/>)}</datalist></label>
    <label>Material<input list="listing-materials" value={f.material} onChange={(e)=>setF({...f,material:e.target.value})}/><datalist id="listing-materials">{["Cotton","Denim","Hemp","Linen","Nylon","Organic cotton","Polyester","Recycled polyester","Silk","Wool"].map((material)=><option key={material} value={material}/>)}</datalist></label>
    <label>Condition<select value={f.condition} onChange={(e)=>setF({...f,condition:e.target.value})}>{["new","excellent","good","fair","poor"].map((condition)=><option key={condition} value={condition}>{condition}</option>)}</select></label>
    <label>Description<textarea value={f.description} onChange={(e)=>setF({...f,description:e.target.value})}/></label>
    <label>Photo URLs<textarea value={f.images} onChange={(e)=>setF({...f,images:e.target.value})} placeholder="Enter one image URL per line"/></label>
    <button className="primary" type="submit" disabled={saving}>{saving?"Publishing…":"Publish listing"}</button>
  </form></section>;
}

function Repairs(){
  const [items,setItems]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  useEffect(()=>{api("/repair-services").then(setItems).catch((e)=>setError(e.message)).finally(()=>setLoading(false));},[]);
  return <section className="page repair-partners-page"><p className="eyebrow">MAKE IT LAST</p><h2>Repair partners</h2>{error&&<p className="form-error" role="alert">{error}</p>}{loading?<p className="loading-state" role="status">Loading repair services…</p>:<>{items.length>0&&<div className="grid">{items.map((x)=><div className="service" key={x._id}><span aria-hidden="true">🧵</span><h3>{x.name}</h3><p>{x.description}</p><b>₹{x.price}</b><small>{x.durationMinutes} min · {x.location}</small><Link className="secondary" to="/repair-booking">Book now</Link></div>)}</div>}{!items.length&&!error&&<div className="empty">No repair services are available right now.</div>}</>}</section>;
}

function RepairBookingPage(){
  const [services,setServices]=useState([]);
  const [bookings,setBookings]=useState([]);
  const [selected,setSelected]=useState("");
  const [date,setDate]=useState("");
  const [itemType,setItemType]=useState("clothing");
  const [serviceMethod,setServiceMethod]=useState("drop_off");
  const [notes,setNotes]=useState("");
  const [error,setError]=useState("");
  const [message,setMessage]=useState("");

  async function refreshBookings(){
    try{setBookings(await api("/repair-bookings"));}
    catch(e){setError(e.message);}
  }
  useEffect(()=>{
    api("/repair-services").then(setServices).catch((e)=>setError(e.message));
    refreshBookings();
  },[]);

  async function submit(e){
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await api("/repair-bookings",{method:"POST",body:JSON.stringify({service:selected,scheduledAt:date,itemType,serviceMethod,notes})});
      setMessage("Repair booking created");
      setSelected("");
      setDate("");
      setItemType("clothing");
      setServiceMethod("drop_off");
      setNotes("");
      await refreshBookings();
    }
    catch(e){ setError(e.message); }
  }
  async function cancelBooking(booking){
    setError("");
    try{
      await api(`/repair-bookings/${booking._id}/status`,{method:"PATCH",body:JSON.stringify({status:"cancelled"})});
      await refreshBookings();
    }catch(e){setError(e.message);}
  }

  return <section className="page"><p className="eyebrow">SERVICE APPOINTMENT</p><h2>Book a repair</h2>{error&&<p className="form-error" role="alert">{error}</p>}{message&&<p className="success-message" role="status">{message}</p>}<form className="formpage form" onSubmit={submit}><select value={selected} onChange={e=>setSelected(e.target.value)} required><option value="">Select repair service</option>{services.map((s)=><option key={s._id} value={s._id}>{s.name} · ₹{s.price}</option>)}</select><select aria-label="Item type" value={itemType} onChange={e=>setItemType(e.target.value)}><option value="clothing">Clothing</option><option value="footwear">Footwear</option><option value="bag">Bag</option><option value="accessory">Accessory</option></select><select aria-label="Service method" value={serviceMethod} onChange={e=>setServiceMethod(e.target.value)}><option value="drop_off">Drop off at repair partner</option><option value="pickup">Request pickup and return</option></select><input type="datetime-local" value={date} onChange={e=>setDate(e.target.value)} required/><textarea placeholder="Notes for the repair partner" value={notes} onChange={e=>setNotes(e.target.value)} /><button className="primary" type="submit">Request booking</button></form><div className="list repair-bookings"><h3>Your repair bookings</h3>{bookings.map((booking)=><div className="list-item" key={booking._id}><span>{booking.service?.name||"Repair"} · {new Date(booking.scheduledAt).toLocaleString()} · {booking.itemType||"clothing"} · {booking.serviceMethod==="pickup"?"Pickup requested":"Drop-off"}</span><span>{booking.status}</span><strong>₹{booking.price}</strong>{booking.status==="requested"&&<button className="secondary" onClick={()=>cancelBooking(booking)}>Cancel</button>}</div>)}{!bookings.length&&<p>No repair bookings yet.</p>}</div></section>;
}

function Auctions(){
  const user=getStoredUser();
  const [auctions,setAuctions]=useState([]),[listings,setListings]=useState([]),[selected,setSelected]=useState(null);
  const [error,setError]=useState(""),[notice,setNotice]=useState(""),[loading,setLoading]=useState(true);
  const [bidAmounts,setBidAmounts]=useState({});
  const [auctionForm,setAuctionForm]=useState({listing:"",startingBid:"",endsAt:""});
  async function refresh(){
    try{setAuctions(await api("/auctions"));setError("");}
    catch(e){setError(e.message);}
    finally{setLoading(false);}
  }
  useEffect(()=>{
    refresh();
    if(user?.role==="seller"||user?.role==="admin") api("/listings").then((rows)=>setListings(rows.filter((listing)=>(user.role==="admin"||String(listing.seller?._id)===String(user.id))&&listing.status==="active"&&!listing.isAuction))).catch((e)=>setError(e.message));
  },[]);
  async function placeBid(auction){
    const amount=Number(bidAmounts[auction._id]);
    if(!Number.isFinite(amount)||amount<=auction.currentBid){setError("Bid must be greater than the current bid");return;}
    setError("");setNotice("");
    try{
      await api(`/auctions/${auction._id}/bids`,{method:"POST",body:JSON.stringify({amount})});
      setBidAmounts((current)=>({...current,[auction._id]:""}));
      setNotice("Bid placed successfully");
      await refresh();
    }catch(e){setError(e.message);}
  }
  async function showAuction(auction){
    try{setSelected(await api(`/auctions/${auction._id}`));}
    catch(e){setError(e.message);}
  }
  async function createAuction(event){
    event.preventDefault();setError("");setNotice("");
    try{
      await api("/auctions",{method:"POST",body:JSON.stringify({...auctionForm,startingBid:Number(auctionForm.startingBid),endsAt:new Date(auctionForm.endsAt).toISOString()})});
      setAuctionForm({listing:"",startingBid:"",endsAt:""});
      setNotice("Auction created; the listing is reserved until the auction ends.");
      await refresh();
    }catch(e){setError(e.message);}
  }
  async function closeAuction(auction){
    setError("");setNotice("");
    try{
      const result=await api(`/auctions/${auction._id}/close`,{method:"POST",body:JSON.stringify({})});
      setNotice(result.winner?`Auction closed. Winning bid: ₹${result.winner.amount}`:"Auction closed without bids; listing returned to the marketplace.");
      await refresh();
    }catch(e){setError(e.message);}
  }
  return <section className="page live-auctions-page"><p className="eyebrow">ONE-OF-A-KIND</p><h2>Live auctions</h2>
    {error&&<p className="form-error" role="alert">{error}</p>}{notice&&<p className="success-message" role="status">{notice}</p>}
    {(user?.role==="seller"||user?.role==="admin")&&<form className="auction-form" onSubmit={createAuction}><h3>Create an auction</h3><select required value={auctionForm.listing} onChange={(e)=>setAuctionForm({...auctionForm,listing:e.target.value})}><option value="">Select {user.role==="admin"?"a listing":"one of your listings"}</option>{listings.map((listing)=><option key={listing._id} value={listing._id}>{listing.title} · ₹{listing.price}</option>)}</select><input required type="number" min="0.01" step="0.01" placeholder="Starting bid" value={auctionForm.startingBid} onChange={(e)=>setAuctionForm({...auctionForm,startingBid:e.target.value})}/><input required type="datetime-local" value={auctionForm.endsAt} onChange={(e)=>setAuctionForm({...auctionForm,endsAt:e.target.value})}/><button className="primary" type="submit">Create auction</button></form>}
    {loading?<p className="loading-state" role="status">Loading auctions…</p>:<><div className="grid">{auctions.map((auction)=><article className="service auction-card" key={auction._id}>
      {auction.listing?.images?.[0]&&<img className="auction-image" src={auction.listing.images[0]} alt={auction.listing.title}/>}
      <h3>{auction.listing?.title||"Auction item"}</h3><p>{auction.listing?.brand} · {auction.listing?.condition}</p>
      <p>Seller: {auction.seller?.name||"Seller"}</p><p>Ends: {new Date(auction.endsAt).toLocaleString()}</p>
      <small>Starting bid ₹{auction.startingBid}</small><h2>₹{auction.currentBid}</h2><p>{auction.currentBidder?.name?`Highest bidder: ${auction.currentBidder.name}`:"No bids yet"}</p>
      <button className="secondary" onClick={()=>showAuction(auction)}>View bid history</button>
      {user?.role==="buyer"&&String(auction.seller?._id)!==String(user.id)&&<form className="bid-form" onSubmit={(event)=>{event.preventDefault();placeBid(auction);}}><input type="number" step="0.01" min={auction.currentBid+0.01} aria-label="Your bid" placeholder={`More than ₹${auction.currentBid}`} value={bidAmounts[auction._id]||""} onChange={(e)=>setBidAmounts({...bidAmounts,[auction._id]:e.target.value})}/><button className="primary" type="submit">Place bid</button></form>}
      {user&&(user.role==="admin"||(String(auction.seller?._id)===String(user.id)&&new Date(auction.endsAt)<=new Date()))&&<button className="primary" onClick={()=>closeAuction(auction)}>Close auction</button>}
    </article>)}</div>
    {!auctions.length&&!error&&<div className="empty">No live auctions right now.</div>}</>}
    {selected&&<div className="modal-backdrop" role="presentation" onClick={()=>setSelected(null)}><section className="auction-modal" role="dialog" aria-modal="true" aria-labelledby="auction-history-title" onClick={(event)=>event.stopPropagation()}><button className="modal-close" onClick={()=>setSelected(null)}>Close</button><h3 id="auction-history-title">Bid history · {selected.listing?.title}</h3>{selected.bids?.length?<ol>{selected.bids.map((bid)=><li key={bid._id}>{bid.bidder?.name||"Buyer"} — ₹{bid.amount} <small>{new Date(bid.createdAt).toLocaleString()}</small></li>)}</ol>:<p>No bids have been placed.</p>}</section></div>}
  </section>;
}

function Impact(){
  const [d,setD]=useState(null),[error,setError]=useState(""),[loading,setLoading]=useState(Boolean(localStorage.getItem("token")));
  const user=getStoredUser();
  useEffect(()=>{ if(localStorage.getItem("token")) api("/impact/me").then(setD).catch((e)=>setError(e.message)).finally(()=>setLoading(false)); },[]);
  const isSeller=(d?.activityType||user?.role)==="sales"||(d?.activityType!="purchases"&&user?.role==="seller"),activityLabel=d?.activityType||(isSeller?"sales":"purchases");
  return <section className="impact page"><p className="eyebrow">YOUR CIRCULAR FOOTPRINT</p><h2>Impact dashboard</h2><p className="impact-intro">Every secondhand garment kept in use can reduce the resources needed for new clothing. See the estimated impact of your completed {activityLabel}.</p>{error&&<p className="form-error" role="alert">{error}</p>}{loading?<p className="loading-state" role="status">Loading your impact…</p>:d?<><div className="stats-grid impact-stats"><div className="stat"><small>Estimated water saved</small><strong>{d.waterSaved.toLocaleString()} L</strong></div><div className="stat"><small>Estimated CO₂e avoided</small><strong>{d.co2Saved.toFixed(1)} kg</strong></div><div className="stat"><small>Garments recirculated</small><strong>{d.pieces}</strong></div><div className="stat"><small>Impact points</small><strong>{d.score}</strong></div></div>{d.records.length>0?<><p className="impact-estimate-note">Environmental savings are estimates based on the impact values for each listing.</p><div className="list"><h3>Impact from your {activityLabel}</h3>{d.records.map((record)=><div className="list-item" key={record.order}><span>Order #{record.order.slice(-8)} · {new Date(record.createdAt).toLocaleDateString()} · {record.pieces} {record.pieces===1?"garment":"garments"}</span><span>{record.waterSaved.toLocaleString()} L water · {record.co2Saved.toFixed(2)} kg CO₂e · estimated</span></div>)}</div></>:<div className="empty">{isSeller?"After your first completed sale, estimated water savings, CO₂e avoided, and garments recirculated will appear here.":"After your first completed purchase, estimated water savings, CO₂e avoided, and garments recirculated will appear here."}</div>}</>:user?null:<p>Log in as a buyer or seller to see your personal environmental impact.</p>}</section>;
}

function CartPage(){
  const [items,setItems]=useState(getCart());
  const total=items.reduce((sum,item)=>sum+Number(item.price||0),0);

  function refresh(){ setItems(getCart()); }

  return <section className="page cart-page"><h2>Your cart</h2>{items.length ? <><div className="grid">{items.map((item)=><div className="service" key={item._id}><h3>{item.title}</h3><p>{item.brand} · {item.condition}</p><b>₹{Number(item.price||0)}</b><button className="secondary" onClick={()=>{ removeFromCart(item._id); refresh(); }}>Remove</button></div>)}</div><div className="summary card"><h3>Order summary</h3><p>Total: <strong>₹{total}</strong></p><Link className="primary" to="/checkout">Checkout</Link></div></>:<div className="empty"><h3>Your cart is empty</h3><p>Find a secondhand piece you love and add it here when you are ready.</p><Link className="primary" to="/browse">Browse the collection</Link></div>}</section>;
}

function CheckoutPage(){
  const [items,setItems]=useState(getCart());
  const [address,setAddress]=useState({name:"",line1:"",city:"",postalCode:"",country:"India"});
  const [error,setError]=useState(""),[notice,setNotice]=useState(""),[paying,setPaying]=useState(false);
  const total=items.reduce((sum,item)=>sum+Number(item.price||0),0);

  async function submitOrder(event){
    event.preventDefault();
    setError("");setNotice("");setPaying(true);
    try {
      const payload={items:items.map((item)=>({listing:item._id,quantity:1})),shippingAddress:address};
      const order=await api("/orders",{method:"POST",body:JSON.stringify(payload)});
      await api(`/orders/${order._id}/payment`,{method:"POST",body:JSON.stringify({})});
      localStorage.removeItem("cart");
      setItems([]);
      setNotice("Order placed and paid successfully.");
    }
    catch(e){ setError(e.message); }
    finally{setPaying(false);}
  }

  return <section className="page"><h2>Checkout</h2>{notice&&<p className="success-message" role="status">{notice}</p>}{items.length ? <form className="checkout-form" onSubmit={submitOrder}>
    <div className="checkout-address">
      <h3>Shipping address</h3>
      <input aria-label="Full name" placeholder="Full name" required value={address.name} onChange={(e)=>setAddress({...address,name:e.target.value})}/>
      <input aria-label="Address line" placeholder="Address line" required value={address.line1} onChange={(e)=>setAddress({...address,line1:e.target.value})}/>
      <input aria-label="City" placeholder="City" required value={address.city} onChange={(e)=>setAddress({...address,city:e.target.value})}/>
      <input aria-label="Postal code" placeholder="Postal code" required value={address.postalCode} onChange={(e)=>setAddress({...address,postalCode:e.target.value})}/>
      <input aria-label="Country" placeholder="Country" required value={address.country} onChange={(e)=>setAddress({...address,country:e.target.value})}/>
    </div>
    <div className="summary card"><p>Items: {items.length}</p><p>Total: <strong>₹{total}</strong></p>{error&&<p className="form-error" role="alert">{error}</p>}<button className="primary" type="submit" disabled={paying}>{paying?"Processing payment…":"Place order and pay"}</button></div>
  </form> : <div className="empty">{notice?"Your order is complete.":"No items to check out."}</div>}</section>;
}

function Orders(){
  const [x,setX]=useState([]),[error,setError]=useState(""),[loading,setLoading]=useState(true);
  const user=getStoredUser();
  async function refresh(){try{setX(await api("/orders"));setError("");}catch(e){setError(e.message);}finally{setLoading(false);}}
  useEffect(()=>{ refresh(); },[]);
  async function changeStatus(order,status){
    try{await api(`/orders/${order._id}/status`,{method:"PATCH",body:JSON.stringify({status})});await refresh();}
    catch(e){setError(e.message);}
  }
  async function cancel(order){
    try{await api(`/orders/${order._id}/cancel`,{method:"POST",body:JSON.stringify({})});await refresh();}
    catch(e){setError(e.message);}
  }
  async function invoice(order){
    try{const data=await api(`/orders/${order._id}/invoice`);alert(`Invoice ${data.invoiceNumber} · Total ₹${data.order.total}`);}
    catch(e){setError(e.message);}
  }
  return <section className="page"><h2>Your orders</h2>{error&&<p className="form-error" role="alert">{error}</p>}{loading?<p className="loading-state" role="status">Loading orders…</p>:x.map((o)=>{
    const nextStatus=o.status==="paid"?"processing":o.status==="processing"?"shipped":o.status==="shipped"?"delivered":null;
    return <div className="order" key={o._id}>
      <div className="order-info"><b>Order #{o._id.slice(-8)}</b><small>{o.items?.map((item)=>item.listing?.title).filter(Boolean).join(", ")}</small></div>
      <span>{o.status}</span><strong>₹{o.total}</strong>
      <div className="order-actions">
        {user?.role==="seller"&&nextStatus&&<button className="secondary" onClick={()=>changeStatus(o,nextStatus)}>Mark {nextStatus}</button>}
        {user?.role==="buyer"&&o.status==="pending"&&<button className="secondary" onClick={()=>cancel(o)}>Cancel</button>}
        {!["pending","cancelled"].includes(o.status)&&<button className="secondary" onClick={()=>invoice(o)}>Invoice</button>}
      </div>
    </div>;
  })}{!loading&&!x.length&&!error&&<div className="empty"><h3>No orders yet</h3><p>Your completed purchases will appear here after payment.</p><Link className="primary" to="/browse">Browse the collection</Link></div>}</section>;
}

function Messages(){
  const navigate=useNavigate();
  const location=useLocation();
  const selectedId=location.pathname.split("/").filter(Boolean)[1]||"";
  const user=getStoredUser();
  const [conversations,setConversations]=useState([]);
  const [messages,setMessages]=useState([]);
  const [text,setText]=useState("");
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(true);

  async function loadConversations(){
    const rows=await api("/conversations");
    setConversations(rows);
  }
  useEffect(()=>{
    setLoading(true);
    loadConversations().catch((e)=>setError(e.message)).finally(()=>setLoading(false));
  },[]);
  useEffect(()=>{
    if(!selectedId){setMessages([]);return;}
    let active=true;
    async function loadMessages(){
      setError("");
      try{
        const rows=await api(`/conversations/${selectedId}`);
        if(!active) return;
        setMessages(rows);
        const unread=rows.filter((message)=>!message.read&&message.sender?._id!==user?.id);
        if(unread.length){
          await Promise.all(unread.map((message)=>api(`/messages/${message._id}/read`,{method:"PATCH",body:JSON.stringify({})})));
          if(active) await loadConversations();
        }
      }catch(e){if(active)setError(e.message);}
    }
    loadMessages();
    return ()=>{active=false;};
  },[selectedId,user?.id]);

  async function sendMessage(event){
    event.preventDefault();
    const trimmed=text.trim();
    if(!trimmed) return;
    setError("");
    try{
      const message=await api(`/conversations/${selectedId}/messages`,{method:"POST",body:JSON.stringify({text:trimmed})});
      setMessages((current)=>[...current,message]);
      setText("");
      await loadConversations();
    }catch(e){setError(e.message);}
  }
  async function deleteMessage(message){
    setError("");
    try{
      await api(`/messages/${message._id}`,{method:"DELETE"});
      setMessages((current)=>current.filter((item)=>item._id!==message._id));
      await loadConversations();
    }catch(e){setError(e.message);}
  }
  function otherParticipant(conversation){
    return conversation.participants?.find((participant)=>participant._id!==user?.id);
  }

  return <section className="page messages-page">
    <p className="eyebrow">BUYER & SELLER INBOX</p><h2>Messages</h2>
    {error&&<p className="form-error" role="alert">{error}</p>}
    <div className="messaging-layout">
      <aside className="conversation-list" aria-label="Conversations">
        {loading&&<p>Loading conversations…</p>}
        {!loading&&!conversations.length&&<p>No conversations yet. Message a seller from a product page.</p>}
        {conversations.map((conversation)=>{
          const other=otherParticipant(conversation);
          return <button className={`conversation-item ${selectedId===conversation._id?"selected":""}`} key={conversation._id} onClick={()=>navigate(`/messages/${conversation._id}`)}>
            <strong>{other?.name||"Marketplace user"}</strong>
            <small>{conversation.listing?.title||"Listing"}</small>
            <span>{conversation.latestMessage?.text||"Start the conversation"}</span>
            {conversation.unreadCount>0&&<b className="unread-count">{conversation.unreadCount}</b>}
          </button>;
        })}
      </aside>
      <div className="message-panel">
        {selectedId?<><div className="message-thread" aria-live="polite">
          {messages.map((message)=><article className={`message-bubble ${message.sender?._id===user?.id?"mine":"theirs"}`} key={message._id}>
            <small>{message.sender?.name||"User"} · {new Date(message.createdAt).toLocaleString()}</small>
            <p>{message.text}</p>
            {message.sender?._id===user?.id&&<button className="message-delete" onClick={()=>deleteMessage(message)}>Delete</button>}
          </article>)}
          {!messages.length&&<p className="empty">Send a message to start the conversation.</p>}
        </div><form className="message-composer" onSubmit={sendMessage}>
          <textarea aria-label="Message" maxLength="4000" value={text} onChange={(e)=>setText(e.target.value)} placeholder="Write a message…" required/>
          <button className="primary" type="submit" disabled={!text.trim()}>Send</button>
        </form></>:<div className="empty"><h3>Start a conversation</h3><p>Open a listing to ask its seller about fit, condition, delivery, or any other detail.</p><Link className="primary" to="/browse">Browse the collection</Link></div>}
      </div>
    </div>
  </section>;
}

function SellerDashboard(){
  const user=getStoredUser();
  const [items,setItems]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState("");
  useEffect(()=>{if(user)api("/sellers/"+user.id+"/listings").then(setItems).catch((e)=>setError(e.message)).finally(()=>setLoading(false));},[]);
  return <section className="page dashboard"><p className="eyebrow">SELLER HUB</p><h2>Dashboard</h2>{error&&<p className="form-error" role="alert">{error}</p>}{loading?<p className="loading-state" role="status">Loading seller dashboard…</p>:<><div className="stats-grid"><div className="stat"><strong>{items.length}</strong><span>Listings</span></div><div className="stat"><strong>₹{items.reduce((sum,item)=>sum+Number(item.price||0),0)}</strong><span>Inventory value</span></div></div><div className="list"><h3>Listings</h3>{items.map((item)=><div className="list-item" key={item._id}><span>{item.title}</span><span className={`listing-status status-${item.status}`}>{item.status}</span></div>)}{!items.length&&<p>No listings yet. <Link to="/sell">Create your first listing.</Link></p>}</div></>}</section>;
}

function RepairPartnerDashboard(){
  const [bookings,setBookings]=useState([]);
  const [error,setError]=useState("");
  const [service,setService]=useState({name:"",description:"",category:"",price:"",durationMinutes:"",location:""});
  const [notice,setNotice]=useState("");
  async function refresh(){
    try{setBookings(await api("/repair-bookings"));setError("");}
    catch(e){setError(e.message);}
  }
  useEffect(()=>{ refresh(); },[]);
  async function updateStatus(booking,status){
    try{await api(`/repair-bookings/${booking._id}/status`,{method:"PATCH",body:JSON.stringify({status})});await refresh();}
    catch(e){setError(e.message);}
  }
  async function publishService(event){
    event.preventDefault();
    setError("");
    setNotice("");
    try{
      await api("/repair-services",{method:"POST",body:JSON.stringify({...service,price:Number(service.price),durationMinutes:Number(service.durationMinutes)})});
      setService({name:"",description:"",category:"",price:"",durationMinutes:"",location:""});
      setNotice("Repair service published");
    }catch(e){setError(e.message);}
  }
  return <section className="page dashboard"><p className="eyebrow">REPAIR PARTNER</p><h2>Booking overview</h2>{error&&<p className="form-error" role="alert">{error}</p>}{notice&&<p className="success-message" role="status">{notice}</p>}<div className="stats-grid"><div className="stat"><strong>{bookings.length}</strong><span>Total bookings</span></div></div><div className="list"><h3>Upcoming bookings</h3>{bookings.map((b)=>{
    const next=b.status==="requested"?"confirmed":b.status==="confirmed"?"in_progress":b.status==="in_progress"?"completed":null;
    return <div className="list-item" key={b._id}><span>{b.service?.name||"Repair"} · {b.buyer?.name||"Buyer"} · {new Date(b.scheduledAt).toLocaleString()}</span><span>{b.status}</span>{next&&<button className="secondary" onClick={()=>updateStatus(b,next)}>Mark {next.replace("_"," ")}</button>}</div>;
  })}{!bookings.length&&<p>No bookings yet.</p>}</div><div className="list"><h3>Publish a repair service</h3><form className="repair-service-form" onSubmit={publishService}>
    <input required aria-label="Service name" placeholder="Service name" value={service.name} onChange={(e)=>setService({...service,name:e.target.value})}/>
    <textarea required aria-label="Description" placeholder="Description" value={service.description} onChange={(e)=>setService({...service,description:e.target.value})}/>
    <input required aria-label="Category" placeholder="Category" value={service.category} onChange={(e)=>setService({...service,category:e.target.value})}/>
    <input required type="number" min="0" aria-label="Price" placeholder="Price" value={service.price} onChange={(e)=>setService({...service,price:e.target.value})}/>
    <input required type="number" min="1" step="1" aria-label="Duration in minutes" placeholder="Duration in minutes" value={service.durationMinutes} onChange={(e)=>setService({...service,durationMinutes:e.target.value})}/>
    <input required aria-label="Location" placeholder="Location" value={service.location} onChange={(e)=>setService({...service,location:e.target.value})}/>
    <button className="primary" type="submit">Publish service</button>
  </form></div></section>;
}

function AdminDashboard(){
  const [stats,setStats]=useState(null);
  const [reports,setReports]=useState([]);
  const [error,setError]=useState("");
  async function refresh(){
    try{
      const [dashboard,reportsData]=await Promise.all([api("/admin/dashboard"),api("/admin/reports")]);
      setStats(dashboard);setReports(reportsData);setError("");
    }catch(e){setError(e.message);}
  }
  useEffect(()=>{refresh();},[]);
  async function updateReport(report,status){
    try{await api(`/admin/reports/${report._id}`,{method:"PATCH",body:JSON.stringify({status})});await refresh();}
    catch(e){setError(e.message);}
  }
  async function moderateListing(report,status){
    try{await api(`/admin/listings/${report.targetId}/moderate`,{method:"PATCH",body:JSON.stringify({status})});await updateReport(report,"resolved");}
    catch(e){setError(e.message);}
  }
  return <section className="page dashboard"><p className="eyebrow">ADMIN OPERATIONS</p><h2>Platform overview</h2>{error&&<p className="form-error" role="alert">{error}</p>}{stats&&<div className="stats-grid"><div className="stat"><strong>{stats.users}</strong><span>Users</span></div><div className="stat"><strong>{stats.listings}</strong><span>Listings</span></div><div className="stat"><strong>{stats.orders}</strong><span>Orders</span></div><div className="stat"><strong>{stats.reports.open}</strong><span>Open reports</span></div><div className="stat"><strong>{stats.reports.reviewing}</strong><span>Reports reviewing</span></div><div className="stat"><strong>{stats.reports.closed}</strong><span>Closed reports</span></div></div>}<div className="list"><h3>Reports</h3>{reports.map((report)=><div className="admin-report" key={report._id}>
    <div><strong>{report.reason}</strong><p>{report.details||"No additional details"}</p><small>{report.targetType} · {report.reporter?.name||"User"} · {new Date(report.createdAt).toLocaleString()}</small>{report.target&&<p className="report-target">{report.target.title||report.target.name||report.target.text||report.target.reason||`Target ${report.targetId}`}</p>}</div>
    <span className={`report-status status-${report.status}`}>{report.status}</span>
    <div className="action-row">
      {report.status==="open"&&<button className="secondary" onClick={()=>updateReport(report,"reviewing")}>Start review</button>}
      {report.targetType==="listing"&&report.status!=="resolved"&&report.status!=="rejected"&&<><button className="secondary" onClick={()=>moderateListing(report,"paused")}>Pause listing</button><button className="secondary" onClick={()=>moderateListing(report,"rejected")}>Reject listing</button></>}
      {["open","reviewing"].includes(report.status)&&<><button className="secondary" onClick={()=>updateReport(report,"resolved")}>Resolve</button><button className="secondary" onClick={()=>updateReport(report,"rejected")}>Dismiss</button></>}
    </div>
  </div>)}{!reports.length&&<p>No reports have been submitted.</p>}</div></section>;
}

function ProtectedRoute({allowedRoles,children}){
  const user=getStoredUser();
  if(!user) return <Navigate to="/login" replace />;
  if(allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function NotFound(){
  return <section className="page"><h2>Page not found</h2><Link to="/">Go home</Link></section>;
}

function App(){
  return <Layout><Routes>
    <Route path="/" element={<Home/>}/>
    <Route path="/browse" element={<Browse/>}/>
    <Route path="/product/:id" element={<ProductRoute/>}/>
    <Route path="/login" element={<Auth/>}/>
    <Route path="/register" element={<Auth register/>}/>
    <Route path="/sell" element={<ProtectedRoute allowedRoles={["seller","admin"]}><Sell/></ProtectedRoute>}/>
    <Route path="/repairs" element={<Repairs/>}/>
    <Route path="/repair-booking" element={<ProtectedRoute allowedRoles={["buyer","admin"]}><RepairBookingPage/></ProtectedRoute>}/>
    <Route path="/auctions" element={<Auctions/>}/>
    <Route path="/impact" element={<Impact/>}/>
    <Route path="/cart" element={<CartPage/>}/>
    <Route path="/checkout" element={<ProtectedRoute allowedRoles={["buyer","admin"]}><CheckoutPage/></ProtectedRoute>}/>
    <Route path="/orders" element={<ProtectedRoute allowedRoles={["buyer","seller","admin"]}><Orders/></ProtectedRoute>}/>
    <Route path="/messages" element={<ProtectedRoute><Messages/></ProtectedRoute>}/>
    <Route path="/messages/:id" element={<ProtectedRoute><Messages/></ProtectedRoute>}/>
    <Route path="/seller" element={<ProtectedRoute allowedRoles={["seller","admin"]}><SellerDashboard/></ProtectedRoute>}/>
    <Route path="/repair-partner" element={<ProtectedRoute allowedRoles={["repair_partner","admin"]}><RepairPartnerDashboard/></ProtectedRoute>}/>
    <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin"]}><AdminDashboard/></ProtectedRoute>}/>
    <Route path="*" element={<NotFound/>}/>
  </Routes></Layout>;
}

function ProductRoute(){
  const {pathname}=useLocation();
  return <ProductPage id={pathname.split("/").pop()}/>;
}

createRoot(document.getElementById("root")).render(<BrowserRouter><App/></BrowserRouter>);
