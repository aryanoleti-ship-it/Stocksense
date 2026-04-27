// HELPERS
function fmt(n){return (n||0).toLocaleString('en-IN');}
function fmtCap(v){if(!v)return 'N/A';var cr=v/1e7;if(cr>=100000)return (cr/100000).toFixed(1)+'L Cr';if(cr>=1000)return (cr/1000).toFixed(1)+'K Cr';return Math.round(cr)+' Cr';}
function fmtVol(v){if(!v)return 'N/A';if(v>=1e7)return (v/1e7).toFixed(1)+'Cr';if(v>=1e5)return (v/1e5).toFixed(1)+'L';return v.toLocaleString('en-IN');}
function calcRisk(b){return !b?'Medium':b<0.8?'Low':b<1.2?'Medium':'High';}
function genPrices(base,days,vol){vol=vol||0.012;var d=[];var p=base*(1-(days/365)*0.07);var now=new Date();for(var i=days;i>=0;i--){var dt=new Date(now);dt.setDate(dt.getDate()-i);p=Math.max(p*(1+(Math.random()-0.46)*vol),1);d.push({x:dt.toLocaleDateString('en-IN',{day:'2-digit',month:'short'}),y:Math.round(p)});}return d;}

// NAVIGATION
function go(id,ticker){
  document.querySelectorAll('.page').forEach(function(p){p.style.display='none';});
  document.querySelectorAll('.links button').forEach(function(b){b.classList.remove('active');});
  document.getElementById('p-'+id).style.display='block';
  var nb=document.getElementById('n-'+id);if(nb)nb.classList.add('active');
  if(ticker)curTicker=ticker;
  if(id==='market')renderMarket();
  if(id==='all')renderAllStocks();
  if(id==='detail')renderStockDetail();
  if(id==='port')renderPortfolio();
  if(id==='gloss')renderGlossary();
  if(id==='news')renderNews();
  if(id==='ai')initChat();
}
function hs(){var q=document.getElementById('hs').value.trim().toUpperCase();var sym=q+'.NS';if(NMETA[sym]){go('detail',sym);}else{alert('Try: RELIANCE, TCS, INFY, HDFCBANK...');}}

// GET STOCK DATA - live first, then fallback with unique prices
function getS(sym){
  var live=liveStocks[sym];
  if(live&&live.p>0)return Object.assign({},live,{sym:sym,name:(NMETA[sym]||{n:sym}).n,sector:(NMETA[sym]||{s:'Unknown'}).s});
  var fb=FALLBACK[sym]||{p:1000,c:0,pct:0,mc:'N/A',pe:'N/A',eps:'N/A',div:'N/A',beta:'N/A',vol:'N/A',h52:0,l52:0,risk:'Medium'};
  var meta=NMETA[sym]||{n:sym,s:'Unknown'};
  return Object.assign({},fb,{sym:sym,name:meta.n,sector:meta.s});
}

// LIVE DATA - tries multiple proxies
async function fetchLive(){
  var apiUrl='https://query1.finance.yahoo.com/v7/finance/quote?symbols='+[...N50,...IDX_SYMS].join(',')+'&fields=regularMarketPrice,regularMarketChange,regularMarketChangePercent,marketCap,trailingPE,epsTrailingTwelveMonths,dividendYield,beta,regularMarketVolume,fiftyTwoWeekHigh,fiftyTwoWeekLow';
  var results=null;
  for(var pi=0;pi<PROXIES.length;pi++){
    try{
      var r=await fetch(PROXIES[pi]+encodeURIComponent(apiUrl),{signal:AbortSignal.timeout(8000)});
      var data=await r.json();
      results=(data&&data.quoteResponse&&data.quoteResponse.result)||[];
      if(results.length>0)break;
    }catch(e){results=null;}
  }
  if(!results||!results.length){
    document.getElementById('ldot').style.background='#f59e0b';
    document.getElementById('ltxt').textContent='Using latest known prices';
    renderHome();
    if(document.getElementById('p-all').style.display!=='none')renderAllStocks();
    if(document.getElementById('p-market').style.display!=='none')renderMarket();
    return;
  }
  for(var i=0;i<N50.length;i++){
    var sym=N50[i];
    var q=results.find(function(r){return r.symbol===sym;});
    if(q&&q.regularMarketPrice>0){
      liveStocks[sym]={p:Math.round(q.regularMarketPrice*100)/100,c:Math.round((q.regularMarketChange||0)*100)/100,pct:Math.round((q.regularMarketChangePercent||0)*100)/100,mc:fmtCap(q.marketCap),pe:q.trailingPE?q.trailingPE.toFixed(1):'N/A',eps:q.epsTrailingTwelveMonths?q.epsTrailingTwelveMonths.toFixed(2):'N/A',div:q.dividendYield?(q.dividendYield*100).toFixed(2)+'%':'0%',beta:q.beta?q.beta.toFixed(2):'N/A',vol:fmtVol(q.regularMarketVolume),h52:Math.round(q.fiftyTwoWeekHigh||0),l52:Math.round(q.fiftyTwoWeekLow||0),risk:calcRisk(q.beta)};
    }
  }
  var idxKeys=Object.keys(IDX_MAP);
  for(var j=0;j<idxKeys.length;j++){
    var ys=idxKeys[j];var idxId=IDX_MAP[ys];
    var q2=results.find(function(r){return r.symbol===ys;});
    if(q2&&q2.regularMarketPrice>0){var idx=INDICES.find(function(x){return x.id===idxId;});if(idx){idx.v=Math.round(q2.regularMarketPrice);idx.c=Math.round((q2.regularMarketChange||0)*10)/10;idx.p=Math.round((q2.regularMarketChangePercent||0)*100)/100;}}
  }
  var sm={};
  for(var k=0;k<N50.length;k++){var s=getS(N50[k]);if(s){if(!sm[s.sector])sm[s.sector]=[];sm[s.sector].push(s.pct);}}
  for(var l=0;l<SECTORS.length;l++){var sec=SECTORS[l];if(sm[sec.s]&&sm[sec.s].length){sec.c=Math.round(sm[sec.s].reduce(function(a,b){return a+b;},0)/sm[sec.s].length*100)/100;}}
  document.getElementById('ldot').style.background='#16a34a';
  document.getElementById('ltxt').textContent='Live \u00b7 '+new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'});
  renderHome();
  if(document.getElementById('p-all').style.display!=='none')renderAllStocks();
  if(document.getElementById('p-market').style.display!=='none')renderMarket();
}
function refresh(){document.getElementById('ldot').style.background='#f59e0b';document.getElementById('ltxt').textContent='Fetching...';fetchLive();}

// HTML HELPERS
function idxHTML(idx){var up=idx.c>=0;return '<div class="icard"><div class="iname">'+idx.n+'</div><div class="ival">'+fmt(idx.v)+'</div><div class="ichg '+(up?'up':'dn')+'">'+(up?'+':'')+idx.c.toFixed(1)+' ('+(up?'+':'')+idx.p.toFixed(2)+'%)</div></div>';}
function srowHTML(s,sym){var up=s.pct>=0;return '<button class="srow" onclick="go(\'detail\',\''+sym+'\')"><span class="tk">'+sym.replace('.NS','')+'</span><span class="nm">'+s.name+'</span><span class="pr">&#8377;'+fmt(s.p)+'</span><span class="pc '+(up?'up':'dn')+'">'+(up?'+':'')+s.pct.toFixed(2)+'%</span></button>';}

// HOME
function renderHome(){
  document.getElementById('hidx').innerHTML=INDICES.map(function(i){return idxHTML(i);}).join('');
  var sorted=N50.map(function(s){return getS(s);}).sort(function(a,b){return b.pct-a.pct;});
  document.getElementById('hg').innerHTML=sorted.filter(function(s){return s.pct>0;}).slice(0,3).map(function(s){return srowHTML(s,s.sym);}).join('');
  document.getElementById('hl').innerHTML=sorted.filter(function(s){return s.pct<0;}).slice(0,3).map(function(s){return srowHTML(s,s.sym);}).join('');
  var chips=['RELIANCE','TCS','HDFCBANK','INFY','BHARTIARTL','TATAMOTORS','SUNPHARMA'];
  document.getElementById('hchips').innerHTML=chips.map(function(t){return '<button class="chip" onclick="go(\'detail\',\''+t+'.NS\')">'+t+'</button>';}).join('');
}

// MARKET
function renderMarket(){
  document.getElementById('midx').innerHTML=INDICES.map(function(i){return idxHTML(i);}).join('');
  var sorted=N50.map(function(s){return getS(s);}).sort(function(a,b){return b.pct-a.pct;});
  document.getElementById('mg').innerHTML=sorted.filter(function(s){return s.pct>0;}).slice(0,5).map(function(s){return srowHTML(s,s.sym);}).join('');
  document.getElementById('ml').innerHTML=sorted.filter(function(s){return s.pct<0;}).slice(0,3).map(function(s){return srowHTML(s,s.sym);}).join('');
  var nData=genPrices(INDICES[0].v,30,0.008);
  if(nChart)nChart.destroy();
  nChart=new Chart(document.getElementById('nc'),{type:'line',data:{labels:nData.map(function(d){return d.x;}),datasets:[{data:nData.map(function(d){return d.y;}),borderColor:'#2d6a5e',borderWidth:2,fill:true,backgroundColor:'rgba(45,106,94,.1)',pointRadius:0,tension:.4}]},options:{plugins:{legend:{display:false}},scales:{x:{ticks:{maxTicksLimit:6,font:{size:10}},grid:{display:false}},y:{ticks:{callback:function(v){return (v/1000).toFixed(0)+'k';},font:{size:10}},grid:{color:'#f0f0f0'}}}}});
  if(secChart)secChart.destroy();
  secChart=new Chart(document.getElementById('sc'),{type:'bar',data:{labels:SECTORS.map(function(s){return s.s;}),datasets:[{data:SECTORS.map(function(s){return s.c;}),backgroundColor:SECTORS.map(function(s){return s.c>=0?'#2d6a5e':'#ef4444';}),borderRadius:4}]},options:{plugins:{legend:{display:false}},scales:{x:{ticks:{font:{size:10}},grid:{display:false}},y:{ticks:{callback:function(v){return v+'%';},font:{size:10}},grid:{color:'#f0f0f0'}}}}});
}

// ALL STOCKS
function renderAllStocks(){
  var q=(document.getElementById('as-q').value||'').toLowerCase();
  var sec=document.getElementById('as-s').value;
  var ord=document.getElementById('as-o').value;
  var list=N50.map(function(sym){return getS(sym);});
  if(q)list=list.filter(function(s){return s.sym.toLowerCase().indexOf(q)>-1||s.name.toLowerCase().indexOf(q)>-1;});
  if(sec)list=list.filter(function(s){return s.sector===sec;});
  if(ord==='gain')list.sort(function(a,b){return b.pct-a.pct;});
  else if(ord==='lose')list.sort(function(a,b){return a.pct-b.pct;});
  else if(ord==='phi')list.sort(function(a,b){return b.p-a.p;});
  else if(ord==='plo')list.sort(function(a,b){return a.p-b.p;});
  else list.sort(function(a,b){return a.name.localeCompare(b.name);});
  document.getElementById('asg').innerHTML=list.length?list.map(function(s){var up=s.pct>=0;return '<div class="ms" onclick="go(\'detail\',\''+s.sym+'\')"><div class="ml"><div class="tk">'+s.sym.replace('.NS','')+'</div><div class="nm">'+s.name+' \u00b7 '+s.sector+'</div></div><div class="mr"><div class="pr">&#8377;'+fmt(s.p)+'</div><div class="pc '+(up?'up':'dn')+'">'+(up?'+':'')+s.pct.toFixed(2)+'%</div></div></div>';}).join(''):'<div style="text-align:center;padding:40px;color:#9ca3af;font-size:13px">No stocks found</div>';
}
function fas(){renderAllStocks();}
