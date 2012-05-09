var _isIE=(window.navigator.appName.toLowerCase().indexOf("microsoft")>=0);
var _isFF=(window.navigator.userAgent.toLowerCase().indexOf("firefox")>=0);
var _isNS=(window.navigator.appName.toLowerCase().indexOf("netscape")>=0);
var _I=null; //UltraTree instance

function AJAX(URL)
{
	this.debug=false;
	this.obj=_isIE?new ActiveXObject("Microsoft.XMLHTTP"):new XMLHttpRequest();
	this.XML=null;
	this.error=null;
	this.remote=URL;
	this.text=null;
}
AJAX.prototype.get=function(isSync)
{
	return this.post(null,isSync,true);
}
AJAX.prototype.post=function(message,isSync,isGet)
{
	try {
		this.XML=null;
		var ajax=this;
		with (this.obj) {
			onreadystatechange=function(){
				if(readyState==4) {
					if(status==200) {
						if(ajax.debug) alert("responseText:\r\n"+responseText+"\r\nContent-Type:"+getResponseHeader("Content-Type")+"\r\nresponseXML:"+typeof(responseXML));
						ajax.XML=responseXML;
						ajax.text=responseText;
					}
					else
						ajax.error=new Error("返回HTTP错误状态："+status);
					if(typeof(ajax.onload)=="function")
						ajax.onload(ajax.error==null);
				}
			}
			open((isGet?"GET":"POST"),this.remote+(this.remote.indexOf("?")>=0? "&":"?")+"tmp="+Math.random(),(isSync?false:true));
			if(!(isGet==true)) {
				setRequestHeader("Content-Length", message.length);
				setRequestHeader("Content-Type", "application/x-www-form-urlencoded; charset:UTF-8");
			}
			send(message);
		}
	}
	catch (E) {
		this.error=E;
	}
	return this.XML;
}
AJAX.prototype.async=function(obj)
{
	if(typeof(obj.onload)=="function")
		obj.onload(this.error==null);
	if(typeof(obj.addon)=="function")
		obj.addon(this.error==null);
	obj.addon=null;
}

function UltraTree(DIV,suffix,sort,order,imageFile)
{
	_I=this;
	this.debug=false;
	this.out=DIV;
	this.URI=suffix;
	this.XML=[];
	this.AJAX=null;
	this.status=[];
	this.sort=sort; //列表排序顺序
	this.order=order; //列表排序
	this.focus=null; //当前树节点
	this.objCopy=null;
	this.renaming=false;
	this.adding=null;
	this.uploading=false;
	this.img=typeof(imageFile)=="undefined"? "":imageFile;
}
UltraTree.prototype.data=function(ID,xpath,isAll)
{
	if(_isIE)
		return this.XML[ID]? (isAll?this.XML[ID].documentElement.selectNodes(xpath):this.XML[ID].documentElement.selectSingleNode(xpath)):null;
	else {
		var xpe=new XPathEvaluator();
		var nsResolver=xpe.createNSResolver(this.XML[ID].ownerDocument==null?this.XML[ID].documentElement:this.XML[ID].ownerDocument.documentElement);
		var result=xpe.evaluate(xpath,this.XML[ID],nsResolver,0,null);
		var nodes=[];
		while (res=result.iterateNext())
			nodes.push(res);
		if(!nodes||nodes.length<1) return null;
		return isAll?nodes:nodes[0];
	}
}
UltraTree.prototype.attrib=function(xpath,ID,key)
{
	if(typeof(ID)=="undefined")
		ID=this.node(this.focus);
	var obj=this.data(ID,xpath);
	if(obj==null)
		return null;
	else if(typeof(key)!="undefined")
		return obj.getAttribute(key);
	else {
		var n=xpath.lastIndexOf('/');
		var name=xpath.substring(n+1),tag=null;
		var value=_isIE?obj.xml.substring(name.length+2,obj.xml.length-name.length-3):obj.textContent;
		if(xpath.substr(n+1)=="CloseTag")
			return value;
		xpath=xpath.substring(0,n+1)+"CloseTag";
		tag=this.attrib(xpath,ID);
		if (value.indexOf("<![CDATA[")==0)
			value=value.substring(9,value.length-3);
		if (tag!=null)
			value=value.replace(new RegExp("\\]\\]"+tag+"\>","ig"),"]]>");
		return value;
	}
}
UltraTree.prototype.node=function(obj,key)
{
	var path=obj.parentNode.parentNode.id;
	var n=path.lastIndexOf("/"), nodeId=path.substr(n+1), parent=path.substring(0,n>0? n:n+1);
	if(typeof(key)=="undefined")
		return path;
	else
		return this.attrib("/Node/Node[@id='"+nodeId+"']",parent,key);
}
UltraTree.prototype.select=function(node)
{
	var span;
	if(this.focus!=null&&this.focus.tagName!="DIV")
		this.focus.parentNode.className="Node";
	this.focus=node;
	if(node!=null&&node.tagName!="DIV") {
		node.parentNode.className="focus";
		node.blur();
	}
	return node;
}
UltraTree.prototype.check=function(node,isSwitch)
{
	var checked;
	if (node.tagName == "INPUT") {
		checked=node.checked;
		node=node.parentNode.childNodes[2].firstChild;
		this.select(node);
	}
	else {
		var input=node.parentNode.parentNode.firstChild;
		input.checked=!input.checked;
		checked=input.checked;
	}
	var path=this.node(this.focus);
	var ajax=new AJAX(this.URI+"do=check&node="+escape(path)+"&status="+checked+"&switch="+isSwitch);
	ajax.onload=function() {
		_I.XML[path]=this.XML;
		this.async(_I);
	}
	this.onload=function() {
		if (this.attrib("/File/Status")!="true") {
			if (ajax.error)
				this.report("选中出错。\n\n错误信息：\n"+ajax.error.description, "ALERT");
			else {
				if (this.attrib("/File/Reason")==null)
					this.report("选中出错。\n\n返回未格式化信息：\n"+ajax.text, "ALERT");
				else
					this.report("选中出错。\n\n原因：\n"+this.attrib("/File/Reason")+"\n\n建议：\n"+this.attrib("/File/Advice"), "ALERT");
			}
			this.report("选中出错。", "AUTO");
		}
		else {
			this.report("选中“ "+path+" ”成功。", "AUTO");
		}
	}
	ajax.get();
}
UltraTree.prototype.report=function(message,type)
{
	if (this.intervalHandler)
		 clearInterval(this.intervalHandler);
	if (this.timeoutHandler)
		 clearTimeout(this.timeoutHandler);
	switch (type) {
		case "WAIT":
			parent.window.status=message;
			this.intervalHandler=setInterval(function(){parent.window.status=parent.window.status+".";}, 500);
			break;
		case "AUTO":
			parent.window.status=message;
			this.timeoutHandler=setTimeout(function(){parent.window.status="";}, 5000);
			break;
		case "ALERT":
			alert(message);
			break;
		default:
			parent.window.status=message;
	}
}
UltraTree.prototype.findXY=function(obj)
{
	var x=0,y=0;
	while(obj!=null) {
		x+=obj.offsetLeft-obj.scrollLeft;
		y+=obj.offsetTop-obj.scrollTop;
		obj=obj.offsetParent;
	}
	return {x:x,y:y};
}
UltraTree.prototype.dispatch=function(node)
{
	this.select(node);
	nodeType=this.node(node,"type");
	cmd=CM[nodeType][0][1];
	eval(cmd);
	return false;
}
UltraTree.prototype.toggle=function(node)//node is <A> (<DIV><SPAN><A/></SPAN></DIV)
{
	var path=this.node(node), DIV=node.parentNode.parentNode;
	if((this.status[path]&1)==0) {
		var el=this.data(DIV.parentNode.parentNode.id,"/Node/Node[@id='"+this.node(node,"id")+"']");
		if (el.firstChild) { // 有子目录数据
			var doc=_isIE?new ActiveXObject("Microsoft.XMLDOM"):document.implementation.createDocument("text/xml", "", null);
			if (!_isIE)
				el.removeChild(el.firstChild);
			doc.appendChild(el.firstChild);
			this.XML[path]=doc;
			this.render(DIV,this.sort,this.order);
			this.status[DIV.id]|=3;
		}
		else
			this.load(DIV,this.sort,this.order);
	}
	else {
		if (DIV.lastChild.tagName!="DIV") {
			this.render(DIV,this.sort,this.order);
			this.status[path]&=0xFFFD;
		}
		DIV.lastChild.style.display=(this.status[path]&2)==0?"block":"none";
		var type=this.node(node, "type");
		DIV.childNodes[1].src=this.img+"?do=image&file="+((this.status[path]&2)==0?"exp.":"")+type+".gif";
		this.status[path]+=(this.status[path]&2)==0?-2:2;
	}
	return false;
}
UltraTree.prototype.load=function(node,sort,order)
{
	var ajax=new AJAX(this.URI+"do=list&dir="+escape(node.id));
	ajax.onload=function() {
		_I.XML[node.id]=this.XML;
		this.async(_I);
	}
	this.onload=function() {
		node.removeChild(node.lastChild);
		this.render(node,sort,order);
		this.status[node.id]|=3;
	}
	var DIV=document.createElement("DIV");
	DIV.className="container";
	DIV.innerHTML="<font color='red'>正在加载...</font>";
	node.appendChild(DIV);
	ajax.get();
}
UltraTree.prototype.render=function(node,sort,order)//node is <DIV/>
{
/*	<DIV id='@id' class='Node'>
 * 		<input type='checkbox' name='itemSel' class='selector' value='@id'/>
 * 		<img/>
 * 		<span>
 * 			<a>@name or @id</a>
 * 		</span>
 * 		<DIV class='container'>
 * 			<DIV class='Node'>
 * 				...
 * 			</DIV>
 * 		</DIV>
 * 	</DIV>
 * */
	var DIV=document.createElement("DIV"), path=node.id;
	DIV.className="container";
	if(order=="descending")
		if(_isIE)
			DIV.innerHTML=this.XML[path].transformNode(this.getXslTP(sort,order,path,true));
		else
			DIV.appendChild(this.getXslTP(sort,order,path,true).transformToFragment(this.XML[path],document));
	if(_isIE)
		DIV.innerHTML=DIV.innerHTML+this.XML[path].transformNode(this.getXslTP(sort,order,path));
	else
		DIV.appendChild(this.getXslTP(sort,order,path).transformToFragment(this.XML[path],document));
	if(order!="descending")
		if(_isIE)
			DIV.innerHTML=DIV.innerHTML+this.XML[path].transformNode(this.getXslTP(sort,order,path,true));
		else
			DIV.appendChild(this.getXslTP(sort,order,path,true).transformToFragment(this.XML[path],document));
	node.appendChild(DIV);
	var type=this.node(DIV.firstChild, "type");
	node.childNodes[1].src=this.img+"?do=image&file=exp."+type+".gif";
}
UltraTree.prototype.getXslTP=function(sort,order,path,dirOnly)
{
	var s2;
	path+=path.length==0||path.charAt(path.length-1)=="/"? "":"/";
	if(order!="ascending"&&order!="descending")
		s2="";
	else if(sort=='name')
		s2="	<xsl:sort order='"+order+"' select='@id' data-type='text'/>";
	else if(sort=='time')
		s2="	<xsl:sort order='"+order+"' select='@time' data-type='number'/>";
	else if(sort=='size')
		s2="	<xsl:sort order='"+order+"' select='@length' data-type='number'/>";
	else if(sort=='type')
		s2="	<xsl:sort order='"+order+"' select='concat(@type,@id)' data-type='text'/>";
	else
		s2="";
	var s1="<?xml version='1.0' encoding='UTF-8'?>\r\n"+
"<xsl:stylesheet version='1.0' xmlns:xsl='http://www.w3.org/1999/XSL/Transform' xmlns:msxsl='urn:schemas-microsoft-com:xslt' xmlns:user='http://editone.gaya.cn'>\r\n"+
"<xsl:template match='/'>\r\n"+
"<xsl:apply-templates select='Node' />\r\n"+
"</xsl:template>\r\n"+
"\r\n"+
"<xsl:template match='Node'>\r\n"+
"<xsl:for-each select='./Node["+(dirOnly?"boolean(@expand)":"not(boolean(@expand))")+"]'>";
	var s3="	<div class='Node'>\r\n"+
"		<xsl:attribute name='id'>"+path+"<xsl:value-of select='@id'/></xsl:attribute>\r\n"+
"		<input type='checkbox' name='itemSel'>\r\n"+
"			<xsl:attribute name='style'>display:"+
"			<xsl:choose>\r\n"+
"				<xsl:when test='boolean(@checkbox)'>inline</xsl:when>\r\n"+
"				<xsl:otherwise>none</xsl:otherwise>\r\n"+
"			</xsl:choose>\r\n"+
"			</xsl:attribute>\r\n"+
"			<xsl:if test='boolean(@checked)'><xsl:attribute name='checked'></xsl:attribute></xsl:if>\r\n"+
"			<xsl:if test='boolean(@disabled)'><xsl:attribute name='disabled'></xsl:attribute></xsl:if>\r\n"+
"			<xsl:attribute name='value'>"+path+"<xsl:value-of select='@id'/></xsl:attribute>\r\n"+
"			<xsl:attribute name='onClick'>javascript:return _I.check(this)</xsl:attribute>\r\n"+
"		</input>\r\n"+
"		<img align='absmiddle'>\r\n"+
"			<xsl:attribute name='src'>"+this.img+"?do=image&amp;file=<xsl:value-of select='@type'/>.gif</xsl:attribute>\r\n"+
"		</img>\r\n"+
"		<span><a>\r\n"+
"			<xsl:attribute name='href'>javascript:void('<xsl:value-of select='@id'/>')</xsl:attribute>\r\n"+
"			<xsl:attribute name='onClick'>javascript:return _I.dispatch(this)</xsl:attribute>\r\n"+
"			<xsl:attribute name='onMouseOver'>javascript:return _I.showDetail(this)</xsl:attribute>\r\n"+
"			<xsl:attribute name='onMouseOut'>javascript:return _I.closeDetail(this)</xsl:attribute>\r\n"+
"			<xsl:choose>\r\n"+
"				<xsl:when test='@name'><xsl:value-of select='@name'/></xsl:when>\r\n"+
"				<xsl:otherwise><xsl:value-of select='@id'/></xsl:otherwise>\r\n"+
"			</xsl:choose>\r\n"+
"		</a></span>\r\n"+
"	</div>\r\n"+
"</xsl:for-each>\r\n"+
"</xsl:template>\r\n"+
"\r\n"+
"</xsl:stylesheet>";
	if(_isIE){
		var XSL=new ActiveXObject("Microsoft.XMLDom");
		XSL.loadXML(s1+s2+s3);
		return XSL;
	}
	else{
		var parser=new DOMParser();
		var XSL=parser.parseFromString(s1+s2+s3, "application/xml");
		var XSLTP=new XSLTProcessor();
		XSLTP.importStylesheet(XSL);
		return XSLTP;
	}
}
UltraTree.prototype.sortBy=function(type)
{
	this.order=(this.sort==type)?(this.order=="ascending"?"descending":"ascending"):"ascending";
	this.sort=type;
	var DIV=this.focus.parentNode.parentNode;
	DIV.removeChild(DIV.lastChild);
	this.render(DIV,type,this.order);
}
UltraTree.prototype.leftClick=function(evt)
{
	var EvtSrc=_isIE?window.event.srcElement.name:evt.target.name;
	if (EvtSrc!="nodeId"&&EvtSrc!="fileUpload") {
		if(this.renaming)
			this.modifyId();
		else if(this.adding!=null)
			this.confirmId();
		else if(this.uploading)
			this.uploadFile();
	}
	document.getElementById("//menu").style.display="none";
	return true;
}
UltraTree.prototype.rightClick=function(evt)
{
	if(evt==null)
		evt=window.event;//IE
	var EvtSrc=_isIE?window.event.srcElement.name:evt.target.name;
	if (EvtSrc!="nodeId"&&EvtSrc!="fileUpload") {
		if (this.renaming)
			this.modifyId();
		else if (this.adding!=null)
			this.confirmId();
		else if (this.uploading)
			this.uploadFile();
	}
	document.getElementById("//detail").style.display="none";
	var target=_isIE?evt.srcElement:evt.target, menu;
	target.blur();
	this.select(target);
	menu=target.tagName=="A"?CM[this.node(target,"type")]:CM["body"];
	if(this.objCopy!=null)
		menu[3][3]=true;
	str="<table border='0' width='100%' cellspacing='1'>";
	for(var n in menu)
		if (menu[n].length>3&&menu[n][3]==false)
			str+="<tr><td>"+menu[n][2]+"</td><td><font color='gray'>"+menu[n][0]+"</font></td></tr>";
		else
			str+="<tr><td>"+menu[n][2]+"</td><td><a href="+menu[n][1]+">"+menu[n][0]+"</a></td></tr>";
	str+="</table>";
	document.getElementById("//menu").innerHTML=str;
	document.getElementById("//menu").style.left=document.body.scrollLeft+46;
	document.getElementById("//menu").style.top=document.body.scrollTop+evt.clientY+10;
	document.getElementById("//menu").style.display="block";
	return false;
}
UltraTree.prototype.showDetail=function(obj,str)
{
	if (typeof(str)=="undefined") {
		var attribs = this.data(obj.parentNode.parentNode.parentNode.parentNode.id,"/Node/Attrib",true),str="";
		for(var i=0;i<attribs.length;i++) {
			var attrib=attribs[i].getAttribute("id"), name=attribs[i].getAttribute("name"), type=attribs[i].getAttribute("type"), unit=attribs[i].getAttribute("unit");
			var value=this.node(obj,attrib);
			if(value==null)
				continue;
			if(type=="size")
				if(value>1024&&value<1048576)
					value=Math.floor(value/102.4)/10+" K&nbsp; &nbsp; &nbsp;("+value+" "+unit+")";
				else if (value>=1048576)
					value=Math.floor(value/104857.6)/10+" M&nbsp; &nbsp; &nbsp;("+value+" "+unit+")";
				else
					value=value+" "+unit;
			else if(type=="time") {
				D=new Date(value*1000);
				value=D.getFullYear()+"年"+(D.getMonth()+1)+"月"+D.getDate()+"日 "+D.getHours()+":"+D.getMinutes()+":"+D.getSeconds();
			}
			else if(type=="text")
				value=value.replace(/\r\n/ig, "<br/>");
			str+=name+": "+value+"<br>";
		}
	}
	if (str=="")
		return false;
	var DIV=obj.document.getElementById("//detail");
	DIV.style.left=document.body.scrollLeft+25;
	DIV.style.top=document.body.scrollTop+this.findXY(obj).y+29;
	DIV.innerHTML=str;
	DIV.style.display="block";
	return false;
}
UltraTree.prototype.closeDetail=function(obj)
{
	obj.document.getElementById("//detail").style.display="none";
	return false;
}
UltraTree.prototype.copy=function()
{
	this.objCopy=this.focus;
}
UltraTree.prototype.paste=function(inDir)
{
	var nodePath=this.node(this.objCopy), dir=this.focus.parentNode.parentNode.id, nodeType=this.node(this.objCopy,"type");
	var ajax=new AJAX(this.URI+"do=paste&node="+escape(nodePath)+"&dir="+escape(dir)+"&type="+nodeType);
	ajax.onload=function() {
		_I.XML["//"]=this.XML;
		this.async(_I);
	}
	this.onload=function() {
		var title="粘贴"+(nodeType=="dir"? "目录":"文件");
		if(this.attrib("/File/Status","//")!="true") {
			if (ajax.error)
				this.report(title+"出错。\n\n错误信息：\n"+ajax.error.description, "ALERT");
			else {
				if (this.attrib("/File/Reason","//")==null)
					this.report(title+"出错。\n\n返回未格式化信息：\n"+ajax.text, "ALERT");
				else
					this.report(title+"出错。\n\n原因：\n"+this.attrib("/File/Reason","//")+"\n\n建议：\n"+this.attrib("/File/Advice","//"), "ALERT");
			}
			obj.parentNode.parentNode.parentNode.removeChild(obj.parentNode.parentNode);
			this.report(title+"出错。", "AUTO");
		}
		else {
			var resumeNode=function(target) {
				var name=_I.attrib("/File/Name","//");

				path=dir+(dir.length==0||dir.charAt(dir.length-1)=="/"? "":"/")+name;
				var DIV=document.createElement("DIV");

				DIV.id=path;
				DIV.className="Node";
				DIV.innerHTML="<input type=checkbox value='"+path+"' name='itemSel' class='selector'><img src='"+_I.img+"?do=image&amp;file="+nodeType+".gif' align=absMiddle><span><a href=\"javascript:void('"+name+"')\" onClick='javascript:return _I.dispatch(this)' onMouseOver='javascript:return _I.showDetail(this)' onMouseOut='javascript:return _I.closeDetail(this)'>"+name+"</a></span>";
				target.parentNode.insertBefore(DIV,target);
				_I.XML[path]=ajax.XML;
				_I.select(DIV.childNodes[2].firstChild);
				var node=_I.XML[dir].createElement("Node");
				node.setAttribute("type",nodeType);
				node.setAttribute("time",_I.attrib("/File/Time"));
				node.setAttribute("id",name);
				if(nodeType!="dir")
					node.setAttribute("length",_I.node(_I.objCopy,"length"));
			 	var parent=_I.data(dir,"/Node");
			 	parent.appendChild(node);
			 	_I.report(title+"“ "+nodePath+" ”为“ "+path+" ”成功。", "AUTO");
			}
			if(inDir) {
				if((this.status[dir]&1)==0)
					this.toggle(this.focus);
				else {

					if((this.status[dir]&2)==0)
						this.toggle(this.focus);
					resumeNode(this.focus.parentNode.parentNode.lastChild.firstChild);
				}
			}
			else
				resumeNode(this.focus);
			_I.objCopy=null;
		}
	}
	ajax.get();
	return true;
}
UltraTree.prototype.remove=function()
{
	var path=this.node(this.focus), nodeId=this.node(this.focus,"id"), nodeType=this.node(this.focus,"type");
	var warning=nodeType=="dir"? "您确认要删除目录“ "+nodeId+" ”吗？\n\n警告：\n您删除的是一个目录。如果删除此目录，也将删除此目录下的所有文件和目录！":"您确认要删除文件“ "+nodeId+" ”吗？";
	if (!confirm(warning))
		return false;
	var ajax=new AJAX(this.URI+"do=remove&node="+escape(path)+"&type="+nodeType);
	ajax.onload=function() {
		_I.XML[path]=this.XML;
		this.async(_I);
	}
	this.onload=function() {
		if (this.attrib("/File/Status")!="true") {
			if (ajax.error)
				this.report("删除文件出错。\n\n错误信息：\n"+ajax.error.description, "ALERT");
			else {
				if (this.attrib("/File/Reason")==null)
					this.report("删除文件出错。\n\n返回未格式化信息：\n"+ajax.text, "ALERT");
				else
					this.report("删除文件出错。\n\n原因：\n"+this.attrib("/File/Reason")+"\n\n建议：\n"+this.attrib("/File/Advice"), "ALERT");
			}
			this.report("删除文件出错。", "AUTO");
		}
		else {
		 	var dir=this.focus.parentNode.parentNode.parentNode.parentNode.id, parent=this.data(dir,"/Node");
		 	parent.removeChild(this.data(dir,"/Node/Node[@id='"+nodeId+"']"));
			this.focus.parentNode.parentNode.parentNode.removeChild(this.focus.parentNode.parentNode);
			this.focus=null;
			this.report("删除文件“ "+nodeId+" ”成功。", "AUTO");
		}
	}
	ajax.get();
}

UltraTree.prototype.add=function(type,inDir)
{
	var newNode=function(target) {
		var DIV=document.createElement("DIV");
		DIV.className="Node";
		DIV.innerHTML="<input type=checkbox value='' name='itemSel' class='selector'><img src='"+_I.img+"?do=image&amp;file="+type+".gif' align=absMiddle><span><input id='//nodeId' name='nodeId' type='text' value='"+(type=="dir"? "新建目录名":"新建文件名")+"' size='16' style='margin-left:13px'></span>";
		target.parentNode.insertBefore(DIV,target);
		with(document.getElementById("//nodeId")) {
			onkeyup=function(evt){if(window.event)evt=window.event;if(_I.adding!=null&&evt.keyCode==13)_I.confirmId();}
			focus();
			select();
		}
	}
	this.adding=type;
	if(inDir) {
		var dir=this.node(this.focus);
		if((this.status[dir]&1)==0) {
			this.addon=function(){newNode(this.focus.parentNode.parentNode.lastChild.firstChild);}
			this.toggle(this.focus);
		}
		else {
			if((this.status[dir]&2)==0)
				this.toggle(this.focus);
			newNode(this.focus.parentNode.parentNode.lastChild.firstChild);
		}
	}
	else
		newNode(this.focus);
}
UltraTree.prototype.confirmId=function()//需要parent.mainFrame
{
	var obj=document.getElementById("//nodeId"), newId=obj.value, nodeType=this.adding;
	this.focus=obj;
	var dir=obj.parentNode.parentNode.parentNode.parentNode.id, span=obj.parentNode;
	var path=span.parentNode.id=dir+(dir.length==0||dir.charAt(dir.length-1)=='/'?"":"/")+newId;
	span.parentNode.childNodes[0].value=span.parentNode.id;
	var encoding=parent.mainFrame.document.M.encoding.value;
	var ajax=new AJAX(this.URI+"do=add&node="+escape(path)+"&type="+nodeType+"&encoding="+encoding);
	ajax.onload=function() {
		_I.XML[path]=this.XML;
		this.async(_I);
	}
	this.onload=function() {
		var title="新建"+(nodeType=="dir"? "目录":"文件");
		if(this.attrib("/File/Status")!="true") {
			if (ajax.error)
				this.report(title+"出错。\n\n错误信息：\n"+ajax.error.description, "ALERT");
			else {
				if (this.attrib("/File/Reason")==null)
					this.report(title+"出错。\n\n返回未格式化信息：\n"+ajax.text, "ALERT");
				else
					this.report(title+"出错。\n\n原因：\n"+this.attrib("/File/Reason")+"\n\n建议：\n"+this.attrib("/File/Advice"), "ALERT");
			}
			obj.parentNode.parentNode.parentNode.removeChild(obj.parentNode.parentNode);
			this.report(title+"出错。", "AUTO");
		}
		else {
			span.removeChild(obj);
			span.innerHTML="<a href=\"javascript:void('"+newId+"')\" onClick='javascript:return _I.dispatch(this)' onMouseOver='javascript:return _I.showDetail(this)' onMouseOut='javascript:return _I.closeDetail(this)'>"+newId+"</a>";
			this.focus=span.firstChild;
			var nodeType=this.attrib("/File/Type");
			span.parentNode.childNodes[1].src=_I.img+"?do=image&file="+nodeType+".gif";
			var node=this.XML[dir].createElement("Node");
			node.setAttribute("type",nodeType);
			node.setAttribute("time",this.attrib("/File/Time"));
			node.setAttribute("id",newId);
			if(nodeType!="dir")
				node.setAttribute("length",this.attrib("/File/Length"));
		 	var parent=this.data(dir,"/Node");
		 	parent.appendChild(node);

			this.adding=null;
			this.report(title+"“ "+newId+" ”成功。", "AUTO");
		}
		this.focus=null;
	}
	ajax.post(nodeType=="dir"?"DIR":parent.mainFrame.editorText.value);
}
UltraTree.prototype.rename=function()
{
	var obj=this.focus, path=this.node(obj), oldId=this.node(obj,"id"), span=obj.parentNode;
	this.select(null);
	span.removeChild(obj);
	span.innerHTML="<input id='//nodeId' name='nodeId' type='text' value='"+oldId+"' size='16' style='margin-left:13px'>";
	this.renaming=true;
	with(document.getElementById("//nodeId")) {
		onkeyup=function(evt){if(window.event)evt=window.event;if(_I.renaming&&evt.keyCode==13)_I.modifyId();}
		focus();
		select();
	}
}
UltraTree.prototype.modifyId=function()
{
	var obj=document.getElementById("//nodeId"), newId=obj.value, nodeType=this.node(obj,"type");
	var path=this.node(obj), oldId=this.node(obj,"id");
	var resumeNode=function(name,type) {
		var span=obj.parentNode;
		span.removeChild(obj);
		span.innerHTML="<a href=\"javascript:void('"+name+"')\" onClick='javascript:return _I.dispatch(this)' onMouseOver='javascript:return _I.showDetail(this)' onMouseOut='javascript:return _I.closeDetail(this)'>"+name+"</a>";
		var n=path.lastIndexOf("/"), dir=path.substring(0,n+1);
		_I.focus=span.firstChild;
		_I.renaming=false;
		if (name==oldId)
			return;
		path=dir+name;
	 	span.parentNode.id=path;
	 	dir=n>=0?path.substring(0,n):"";
	 	span.parentNode.childNodes[0].value=path;
	 	span.parentNode.childNodes[1].src=_I.img+"?do=image&file="+((this.status[path]&2)!=0?"exp.":"")+type+".gif";
	 	with(_I.data(dir,"/Node/Node[@id='"+oldId+"']")) {
	 		setAttribute("type",type);
	 		setAttribute("id",name);
	 	}
	}
	if (newId==oldId) {
		resumeNode(oldId);
		return true;
	}
	this.focus=obj;

	var ajax=new AJAX(this.URI+"do=rename&node="+escape(path)+"&name="+escape(newId)+"&type="+nodeType);
	ajax.onload=function() {
		_I.XML[path]=this.XML;
		this.async(_I);
	}
	this.onload=function() {
		var title="重命名"+(nodeType=="dir"? "目录":"文件");
		if(this.attrib("/File/Status")!="true") {
			if (ajax.error)
				this.report(title+"出错。\n\n错误信息：\n"+ajax.error.description, "ALERT");
			else {
				if (this.attrib("/File/Reason")==null)
					this.report(title+"出错。\n\n返回未格式化信息：\n"+ajax.text, "ALERT");
				else
					this.report(title+"出错。\n\n原因：\n"+this.attrib("/File/Reason")+"\n\n建议：\n"+this.attrib("/File/Advice"), "ALERT");
			}
			resumeNode(oldId);
			this.report(title+"出错。", "AUTO");
		}
		else {
			resumeNode(newId,this.attrib("/File/Type"));
			this.report(title+"“ "+oldId+" ”为“ "+newId+" ”成功。", "AUTO");
		}
	}
	ajax.get();
}
UltraTree.prototype.editFile=function()//需要parent.mainFrame
{
	var path=this.node(this.focus), nodeType=this.node(this.focus,"type");
	var encoding=parent.mainFrame.document.M.encoding.value;
	var ajax=new AJAX(this.URI+"do=edit&file="+escape(path)+"&type="+nodeType+"&encoding="+encoding);
	ajax.onload=function() {//加载完成的处理队列
		_I.XML[path]=this.XML;
		this.async(_I);
	}
	this.onload=function() {
		if(this.attrib("/File/Status")!="true") {
			if (ajax.error)
				this.report("加载出错。\n\n错误信息：\n"+ajax.error.description, "ALERT");
			else {
				if (this.attrib("/File/Reason")==null)
					this.report("加载出错。\n\n返回未格式化信息：\n"+ajax.text, "ALERT");
				else
					this.report("加载出错。\n\n原因：\n"+this.attrib("/File/Reason")+"\n\n建议：\n"+this.attrib("/File/Advice"), "ALERT");
			}
			this.report("加载文件出错。", "AUTO");
		}
		else {
			var content=this.attrib("/File/Content");
			this.report("加载文件“ "+path+" ”成功。", "AUTO");
			if(parent.mainFrame.editMode=="preview")
				parent.mainFrame.switchMode("text");
			if(parent.mainFrame.editMode=="text")
				parent.mainFrame.editorText.value=content;
			else
				parent.mainFrame.editorVisual.SetHTML(content);
			parent.mainFrame.document.getElementById("AutoEncoding").innerHTML=this.attrib("/File/Encoding");
			parent.mainFrame.isNeedSave=false;
		}
	}
	ajax.get();
}
UltraTree.prototype.saveFile=function()//需要parent.mainFrame
{
	if (this.focus==null)
		return false;
	var path=this.node(this.focus), nodeType=this.node(this.focus,"type");
	var isSuccess=true;
	this.report("正在保存文件 “ "+path+" ” ...", "WAIT");
	var encoding=parent.mainFrame.document.M.encoding.value;
	var ajax=new AJAX(this.URI+"do=save&file="+escape(path)+"&type="+nodeType+"&encoding="+encoding);
	ajax.onload=function() {
		_I.XML[path]=this.XML;
		this.async(_I);
	}
	this.onload=function() {
		if (this.attrib("/File/Status")!="true") {
			if (ajax.error)
				this.report("保存失败。\n\n错误信息：\n"+ajax.error.description, "ALERT");
			else {
				if (this.attrib("/File/Reason")==null)
					this.report("保存失败。\n\n返回未格式化信息：\n"+ajax.text, "ALERT");
				else
					this.report("保存失败。\n\n原因：\n"+this.attrib("/File/Reason")+"\n\n建议：\n"+this.attrib("/File/Advice"), "ALERT");
			}
			this.report("保存文件失败。", "AUTO");
			isSuccess=false;
		}
		else {
			this.report("文件“ "+path+" ”已保存。", "AUTO");
			parent.mainFrame.isNeedSave=false;
		}
	}
	content=parent.mainFrame.editMode=="html"?parent.mainFrame.editorVisual.GetXHTML():parent.mainFrame.editorText.value;
	ajax.post(content,false);
	return isSuccess;
}
UltraTree.prototype.browseFile=function(type)//需要parent.mainFrame
{
	if(parent.mainFrame.isNeedSave&&confirm("内容已被修改。是否保存？"))
		this.saveFile();
	if(type=="edit") {
		this.addon=parent.mainFrame.switchMode;
		this.editFile();
		return;
	}
	parent.mainFrame.editorText.value="";
	parent.mainFrame.switchMode("preview");
	if(type=="htm"||type=="pic")
		parent.mainFrame.document.getElementById("//previewer").src=this.node(this.focus);
	else if(type=="media") {
		var filename=this.node(this.focus), str;
		switch (filename.substr(filename.lastIndexOf(".")+1).toLowerCase()) {
			case "mp3": case "mpga": case "wav": case "mid": case "wma":
			str="<object id='media' classid='CLSID:22d6f312-b0f6-11d0-94ab-0080c74c7e95' height='66' width='310'><param name='FileName' value='"+filename+"'><param name='autostart' value='true'><embed src='"+filename+"' type='application/x-mplayer2' pluginspage='http://www.microsoft.com/isapi/redir.dll?prd=windows&amp;sbp=mediaplayer&amp;ar=media&amp;sba=plugin&amp;' height='66' width='310' autostart='1'></object>"; break;
			case "rm":
			str="<object id='media' classid='CLSID:CFCDAA03-8BE4-11cf-B84B-0020AFBBCCFA' height='275' width='316'><param name='controls' value='ImageWindow,StatusBar,ControlPanel'><param name='console' value='Clip1'><param name='autostart' value='true'><param name='LOOP' value='1'><param name='src' value='"+filename+"'><embed src='"+filename+"' type='audio/x-pn-realaudio-plugin' console='Clip1' controls='ImageWindow,ControlPanel,StatusBar' height='275' width='316' autostart='true'></object>"; break;
			case "swf":
			str="<object id='media' classid='CLSID:D27CDB6E-AE6D-11cf-96B8-444553540000' codebase='http://download.macromedia.com/pub/shockwave/cabs/flash/swflash.cab#version=5,0,0,0' width='400' height='400'><param name=movie value='"+filename+"'><param name=quality value=high><embed src='"+filename+"' quality=high pluginspage='http://www.macromedia.com/shockwave/download/index.cgi?P1_Prod_Version=ShockwaveFlash' type='application/x-shockwave-flash'></embed></object>"; break;
			case "avi": case "mpg": case "wmv": default:
			str="<EMBED src='"+filename+"' HEIGHT='256' WIDTH='314' AutoStart=1></EMBED>";
		}
		with(parent.mainFrame.document.getElementById("//previewer").contentWindow.document) {
			open();
			write(str);
			close();
		}
	}
}
UltraTree.prototype.upload=function()
{
	with(document.getElementById("//loader").contentWindow.document) {
		open();
		write("<html><head><style>body{font-size:12px; color:#000000; background-color:#F1F1F1; margin-left:0px; margin-top:0px; margin-right:0px; margin-bottom:0px;} input {font-size:12px; height:18px}</style></head><body><form id='F' name='F' action='?do=upload' enctype='multipart/form-data' method='post' onSubmit='parent.upload()'><input type='hidden' name='dir' value='"+this.focus.parentNode.parentNode.id+"'><input id='//nodeId' name='nodeId' type='text' value='' size='12'><input type='file' size='1' name='fileUpload' value='' id='//fileUpload' style='width:0px' onChange='nm=this.value;document.getElementById(\"//nodeId\").value=nm.substring(nm.lastIndexOf(\"\\\\\")+1,nm.length);'></form></body></html>");
		close();
	}
	var DIV=document.createElement("DIV");
	DIV.id="//nodeUpload";
	DIV.className="Node";
	DIV.innerHTML="<input type=checkbox value='' name='itemSel' class='selector'><img src='"+this.img+"?do=image&amp;file=default.gif' align=absMiddle><span><font color='red'>正在上传中...</font></span>";
	this.focus.parentNode.insertBefore(DIV,this.focus);
	var obj=this.findXY(document.getElementById("//nodeUpload"));
	with(document.getElementById("//mobi")) {
		style.left=document.body.scrollLeft+obj.x+20;
		style.top=document.body.scrollTop+obj.y-1;
		style.display="block";
	}
	with(document.getElementById("//loader").contentWindow.document.getElementById("//fileUpload")) {
		focus();
		select();
	}
	this.uploading=true;
}
UltraTree.prototype.uploadFile=function()
{
	this.uploading=false;
	document.getElementById("//mobi").style.display="none";
	var DIV=document.getElementById("//nodeUpload"), loader=document.getElementById("//loader");
	if(loader.contentWindow.document.getElementById("//fileUpload").value=="") {
		DIV.parentNode.removeChild(DIV);
		return false;
	}
	var F=loader.contentWindow.document.getElementById("F");
	var path=F.dir.value+(F.dir.value.length==0||F.dir.value.charAt(F.dir.value.length-1)=="/"?"":"/")+F.nodeId.value;
	F.action=this.URI+"do=upload&name="+escape(F.nodeId.value)+"&path="+escape(path);
	F.submit();
	return true;
}
UltraTree.prototype.uploadReport=function(status,path,type,time,length)
{
	var DIV=document.getElementById("//nodeUpload");
	if(status==true) {
		var n=path.lastIndexOf("/"), name=path.substr(n+1), dir=path.substring(0,n>=0?n:0);
		DIV.id=path;
		DIV.childNodes[0].value=path;
		DIV.childNodes[1].src=this.img+"?do=image&file="+type+".gif";
		DIV.childNodes[2].innerHTML="<a href=\"javascript:void('"+name+"')\" onClick='javascript:return _I.dispatch(this)' onMouseOver='javascript:return _I.showDetail(this)' onMouseOut='javascript:return _I.closeDetail(this)'>"+name+"</a>";
		var node=this.XML[dir].createElement("Node");
		node.setAttribute("type",type);
		node.setAttribute("time",time);
		node.setAttribute("id",name);
		node.setAttribute("length",length);
	 	var parent=this.data(dir,"/Node");
	 	parent.appendChild(node);
	}
	else {
		DIV.parentNode.removeChild(DIV);
		this.report("文件上传失败。\n\n原因："+path+"\n\n建议：\n"+"错误编号:"+type+"; 请查阅相关文档。", "ALERT");
	}
}
UltraTree.prototype.download=function()
{
	document.getElementById("//loader").src=this.URI+"do=download&file="+escape(this.node(this.focus));
	return false;
}
UltraTree.prototype.runScript=function(obj)
{
	window.open(this.node(this.focus)+"?tmp="+Math.random(),'EditOne_Run','resizable=yes,scrollbars=yes,location=yes,toolbar=yes,menubar=yes,top=0,left=0,status=yes,titlebar=1,fullscreen=yes,directories=yes,channelmode=yes');
}