
// setup
var j4p = new Jolokia({url: "metrics"});

var context = cubism.context()
	.serverDelay(0)
	.clientDelay(0)
	.step(1 * 1000) // every 1 seconds
	.size(940);

var jolokia = context.jolokia(j4p);

var colorsRed = ["#fff7ec","#fee8c8","#fdd49e","#fdbb84","#fc8d59","#ef6548","#d7301f","#b30000","#7f0000"],
	colorsGreen = ["#f7fcfd","#e5f5f9","#ccece6","#99d8c9","#66c2a4","#41ae76","#238b45","#006d2c","#00441b"],
	colorsBlue = ["#fff7fb","#ece7f2","#d0d1e6","#a6bddb","#74a9cf","#3690c0","#0570b0","#045a8d","#023858"],
	colorsOrange = ["#ffffe5","#fff7bc","#fee391","#fec44f","#fe9929","#ec7014","#cc4c02","#993404","#662506"],
	colorsPink = ["#fff7f3","#fde0dd","#fcc5c0","#fa9fb5","#f768a1","#dd3497","#ae017e","#7a0177","#49006a"];

var prevUpTime = 0;
var prevProcessCpuTime = 0;

// metrics used
var cpu = jolokia.metric(
	function(resp1, resp2, resp3) {
		var processCpuTime = resp1.value;
		var nCPUs = resp2.value;
		var upTime = resp3.value;
		var cpuUsage = 0;
		
		if(upTime > 0 && processCpuTime > 0) {
			if(prevUpTime > 0 && (upTime > prevUpTime)) {
				// elapsedCpu is in ns and elapsedTime is in ms.
				var elapsedCpu = processCpuTime - prevProcessCpuTime;
				var elapsedTime = upTime - prevUpTime;
				
				// cpuUsage could go higher than 100% because elapsedTime
				// and elapsedCpu are not fetched simultaneously. Limit to
				// 99% to avoid Plotter showing a scale from 0% to 200%.
				cpuUsage =
					Math.round(
						Math.min(100,
							elapsedCpu / (elapsedTime * 10000 * nCPUs) 
                        ) 
                    );   
			}
		}
		
		prevUpTime = upTime;
		prevProcessCpuTime = processCpuTime;
		
		return cpuUsage / 100;
	},
	{type: "read", mbean: "java.lang:type=OperatingSystem", attribute: "ProcessCpuTime"},
	{type: "read", mbean: "java.lang:type=OperatingSystem", attribute: "AvailableProcessors"},
	{type: "read", mbean: "java.lang:type=Runtime", attribute: "Uptime"}, "CPU"
);

var codeCache = jolokia.metric(
	{type: "read", mbean: "java.lang:type=MemoryPool,name=Code Cache", attribute: "Usage", path: "used"},
	{name: "Code Cache", delta: 0}
);

var permGen = jolokia.metric(
	{type: "read", mbean: "java.lang:type=MemoryPool,name=CMS Perm Gen", attribute: "Usage", path: "used"},
	{name: "Perm Gen", delta: 0}
);

var usedHeap = jolokia.metric(
	{type: "read", mbean: "java.lang:type=Memory", attribute: "HeapMemoryUsage", path: "used"},
	{name: "Heap", delta: 0}
);

var maxHeap = jolokia.metric(
	{type: "read", mbean: "java.lang:type=Memory", attribute: "HeapMemoryUsage", path: "max"},
	{name: "Max", delta: 0}
);

var cmsCount = jolokia.metric(
    {type: "read", mbean: "java.lang:name=ConcurrentMarkSweep,type=GarbageCollector", attribute: "CollectionCount"},
    {name: "CMS GC", delta: 10 * 1000}
);

var jiqlRequest = jolokia.metric(
    function(resp) {
      return resp.value.count;
    },
    {type: "read", mbean: "amx:type=web-request-mon,pp=/mon/server-mon[server],name=jiql/server", attribute:"requestcount"}, 
	  {name: "Jiql", delta: 10 * 1000}
);

var wookieRequest = jolokia.metric(
    function(resp) {
      return resp.value.count;
    },
    {type: "read", mbean: "amx:type=web-request-mon,pp=/mon/server-mon[server],name=wookie/server", attribute:"requestcount"}, 
	  {name: "Wookie", delta: 10 * 1000}
);	

var allRequests = jolokia.metric(
    function (resp) {
        var attrs = resp.value;
        var sum = 0;
        for (var key in attrs) {
            sum += attrs[key].requestcount.count;
        }
        return sum;
    },
    {type: "read", mbean: "amx:type=web-request-mon,pp=/mon/server-mon[server],*", attribute:"requestcount"}, 
	  {name:"All", delta: 10 * 1000}
);

var jiqlResponse = jolokia.metric(
	function(resp1, resp2) {
		return (Number(resp2.value.count) / Number(resp1.value.count)) / 1000; 
	},
	{type: "read", mbean: "amx:type=web-request-mon,pp=/mon/server-mon[server],name=jiql/server", attribute: "requestcount"},
	{type: "read", mbean: "amx:type=web-request-mon,pp=/mon/server-mon[server],name=jiql/server", attribute: "processingtime"}, "Jiql"
);

var wookieResponse = jolokia.metric(
	function(resp1, resp2) {
		return (Number(resp2.value.count) / Number(resp1.value.count)) / 1000; 
	},
	{type: "read", mbean: "amx:type=web-request-mon,pp=/mon/server-mon[server],name=wookie/server", attribute: "requestcount"},
	{type: "read", mbean: "amx:type=web-request-mon,pp=/mon/server-mon[server],name=wookie/server", attribute: "processingtime"}, "Wookie"
);

var allResponse = jolokia.metric(
	function(resp1, resp2) {
		return (Number(resp2.value.count) / Number(resp1.value.count)) / 1000; 
	},
	{type: "read", mbean: "amx:type=web-request-mon,pp=/mon/server-mon[server],name=web/request", attribute: "requestcount"},
	{type: "read", mbean: "amx:type=web-request-mon,pp=/mon/server-mon[server],name=web/request", attribute: "processingtime"}, "ALL"
);

var activeThreads = jolokia.metric(
  function(resp) {
    return resp.value.count;
  },
	{type: "read", mbean: "amx:type=thread-pool-mon,pp=/mon/server-mon[server],name=network/http-listener-1/thread-pool", attribute: "currentthreadcount"}, "Active (web)"
);

var busyThreads = jolokia.metric(
  function(resp) {
    return resp.value.count;
  },
	{type: "read", mbean: "amx:type=thread-pool-mon,pp=/mon/server-mon[server],name=network/http-listener-1/thread-pool", attribute: "currentthreadsbusy"}, "Busy (web)"
);

var totalThreads = jolokia.metric(
	{type: "read", mbean: "java.lang:type=Threading", attribute: "ThreadCount"}, "Total"
);

var qp_agent = jolokia.metric(
  function(resp) {
    return resp.value.current;
  },
	{type: "read", mbean: "amx:type=jdbc-connection-pool-app-mon,pp=/mon/server-mon[server],name=resources/h2_agent_pool/jiql", attribute: "numconnused"}, "ap_agent"
);

var qp_central = jolokia.metric(
  function(resp) {
    return resp.value.current;
  },
	{type: "read", mbean: "amx:type=jdbc-connection-pool-app-mon,pp=/mon/server-mon[server],name=resources/h2_central_pool/qSystem", attribute: "numconnused"}, "qp_central"
);

var stat = jolokia.metric(
  function(resp) {
    return resp.value.current;
  },
	{type: "read", mbean: "amx:type=jdbc-connection-pool-app-mon,pp=/mon/server-mon[server],name=resources/h2_stat_pool/stat", attribute: "numconnused"}, "stat"
);

j4p.start(1000);

// graphs
$(function() {
	d3.select("#cpu").call(function (div) {
	
		div.append("div")
			.attr("class", "axis")
			.call(
				context.axis()
					.orient("top")
			);
		div.selectAll(".horizon")
			.data([cpu])
			.enter().append("div")
			.attr("class", "horizon")
			.call(
				context.horizon()
					.colors(colorsRed)
					.format(d3.format(".2p"))
			);
		div.append("div")
            .attr("class", "rule")
            .call(context.rule());
	});
	
	d3.select("#memory").call(function (div) {
	
		div.append("div")
            .attr("class", "axis")
            .call(
				context.axis()
					.orient("top")
			);
        div.selectAll(".horizon")
            .data([usedHeap, permGen, codeCache])
            .enter().append("div")
            .attr("class", "horizon")
            .call(
				context.horizon()
					.colors(colorsGreen)
					.format(d3.format(".2s"))
			);
        div.selectAll(".horizon-gc")
            .data([cmsCount])
            .enter().append("div")
            .attr("class", "horizon horizon-gc")
            .call(
				context.horizon()
					.colors(colorsGreen)
					.format(d3.format(".0"))
					.height(18)
			);
        div.append("div")
            .attr("class", "rule")
            .call(context.rule());

    });
	
	d3.select("#request").call(function (div) {

        div.append("div")
            .attr("class", "axis")
            .call(
				context.axis()
				.orient("top")
			);
        div.selectAll(".horizon")
            .data([jiqlRequest, wookieRequest, allRequests])
            .enter()
            .append("div")
            .attr("class", "horizon")
            .call(
				context.horizon()
					.format(d3.format("10d"))
					.colors(function (d, i) {
						return i == 3 ? colorsGreen : colorsBlue
					})
				);
        div.append("div")
            .attr("class", "rule")
            .call(context.rule());

    });
	
	d3.select("#times").call(function (div) {
	
		div.append("div")
			.attr("class", "axis")
			.call(
				context.axis()
					.orient("top")
			);
		div.selectAll(".horizon")
			.data([jiqlResponse, wookieResponse, allResponse])
			.enter().append("div")
			.attr("class", "horizon")
			.call(
				context.horizon()
					.colors(colorsOrange)
					.format(d3.format(".2f"))
			);
		div.append("div")
            .attr("class", "rule")
            .call(context.rule());
	});
	
	d3.select("#threads").call(function (div) {
	
		div.append("div")
			.attr("class", "axis")
			.call(
				context.axis()
					.orient("top")
			);
		div.selectAll(".horizon")
			.data([activeThreads, busyThreads, totalThreads])
			.enter().append("div")
			.attr("class", "horizon")
			.call(
				context.horizon()
					.colors(colorsPink)
					.format(d3.format("10d"))
			);
		div.append("div")
            .attr("class", "rule")
            .call(context.rule());
	});
	
	d3.select("#jdbc").call(function (div) {
	
		div.append("div")
			.attr("class", "axis")
			.call(
				context.axis()
					.orient("top")
			);
		div.selectAll(".horizon")
			.data([qp_agent, qp_central, stat])
			.enter().append("div")
			.attr("class", "horizon")
			.call(
				context.horizon()
					.colors(colorsBlue)
					.format(d3.format("10d"))
			);
		div.append("div")
            .attr("class", "rule")
            .call(context.rule());
	});
	
	// On mousemove, reposition the chart values to match the rule.
    context.on("focus", function (i) {
        d3.selectAll("#memory .value").style("right", i == null ? null : context.size() - i + "px");
        d3.selectAll("#request .value").style("right", i == null ? null : context.size() - i + "px");
    });
});