var panelOpened=true;
var curColumns;
function switch_menu()
{
	if(panelOpened) {
		curColumns=parent.document.getElementsByTagName("FrameSet").item(0).cols;
		parent.document.getElementsByTagName("FrameSet").item(0).cols="0,*";
		panelOpened=false;
	}
	else {
		parent.document.getElementsByTagName("FrameSet").item(0).cols=curColumns;
		panelOpened=true;
	}
}
//parent.document.getElementsByTagName("FrameSet").item(0).style.cursor="move";
//parent.document.ondblclick=function(evt){if(parent.window.event)evt=parent.window.event;switch_menu();}

//parent.document.onkeydown=function(evt){if(parent.window.event)evt=parent.window.event;return keyHandler(evt);}
document.onkeydown=function(evt){if(window.event)evt=window.event;return keyHandler(evt);}
function keyHandler(event)
{
	if(!event) return true;
	if(event.ctrlKey && event.keyCode==83) { // Ctrl+S
		parent.mainFrame.document.M.save.disabled=true;
		T.saveFile();
		parent.mainFrame.document.M.save.disabled=false;
		return false;
	}
	if(event.keyCode==114) { // F3
		parent.mainFrame.findNext();
		event.keyCode+=1000;
		return false;
	}
	if(event.ctrlKey && event.keyCode==70)	{ // Ctrl+F
		parent.mainFrame.document.M.word_find.focus();
		event.keyCode+=1000;
		return false;
	}
	if(event.ctrlKey && event.keyCode==82)	{ // Ctrl+R
		parent.mainFrame.document.M.word_replace.focus();
		event.keyCode+=1000;
		return false;
	}
	return true;
}

function setCookie(name,value)
{
	var Days=30;
	var exp=new Date();
	exp.setTime(exp.getTime()+Days*24*60*60*1000);
	document.getElementById("/").document.cookie=name+"="+ escape (value)+";expires="+exp.toGMTString();
}
function getCookie(name)
{
	var arr=document.getElementById("/").document.cookie.split("; ");
	for(i=0;i<arr.length;i++)
		if(arr[i].split("=")[0]==name)
			return unescape(arr[i].split("=")[1]);
	return null;
}
function delCookie(name)
{
	var exp=new Date();
	exp.setTime(exp.getTime()-1);
	var cval=getCookie(name);
	if(cval!=null) MainDIV.document.cookie= name+"="+cval+";expires="+exp.toGMTString();
}

var T=null, isLoaded=false;
function initialize(dirStart,URI,sort,order,images) {
	T=new UltraTree(document.getElementById(dirStart),URI,sort,order,images);
	T.load(T.out,T.sort,T.order);
	window.document.onclick=function(evt){return T.leftClick(evt)};
	window.document.oncontextmenu=function(evt){return T.rightClick(evt);}
	isLoaded=true;
}

var CM=[], K;
K="class";
CM[K]=[];
CM[K][CM[K].length]=new Array("打开/关闭","javascript:void(T.toggle(T.focus))","");
CM[K][CM[K].length]=new Array("播放","javascript:void(T.browseFile('"+K+"'))","");
CM[K][CM[K].length]=new Array("下载","javascript:void(T.download())","");
CM[K][CM[K].length]=new Array("复制","javascript:void(T.copy())","");
CM[K][CM[K].length]=new Array("删除","javascript:void(T.remove())","");
CM[K][CM[K].length]=new Array("重命名","javascript:void(T.rename())","");
K="Multi";
CM[K]=[];
CM[K][CM[K].length]=new Array("打开/关闭","javascript:void(T.toggle(T.focus))","");
K="method";
CM[K]=[];
CM[K][CM[K].length]=new Array("选中","javascript:void(T.check(T.focus,false))","");
CM[K][CM[K].length]=new Array("触发选中","javascript:void(T.check(T.focus,true))","");
K="body";
CM[K]=[];
CM[K][CM[K].length]=new Array("新建文件...","javascript:void(T.add('file'))","");
CM[K][CM[K].length]=new Array("新建目录...","javascript:void(T.add('dir'))","");
CM[K][CM[K].length]=new Array("上传文件...","javascript:void(T.upload())","");
CM[K][CM[K].length]=new Array("粘贴","javascript:void(T.paste())","",false);
CM[K][CM[K].length]=new Array("按名称排序","javascript:void(T.sortBy('name'))","");
CM[K][CM[K].length]=new Array("按大小排序","javascript:void(T.sortBy('size'))","");
CM[K][CM[K].length]=new Array("按类型排序","javascript:void(T.sortBy('type'))","");
CM[K][CM[K].length]=new Array("按时间排序","javascript:void(T.sortBy('time'))","");
K="package";
CM[K]=[];
CM[K][CM[K].length]=new Array("打开/关闭","javascript:void(T.toggle(T.focus))","");
CM[K][CM[K].length]=new Array("新建子文件...","javascript:void(T.add('file',true))","");
CM[K][CM[K].length]=new Array("新建子目录...","javascript:void(T.add('dir',true))","");
CM[K][CM[K].length]=new Array("粘贴","javascript:void(T.paste(true))","",false);
CM[K][CM[K].length]=new Array("复制","javascript:void(T.copy())","");
CM[K][CM[K].length]=new Array("删除","javascript:void(T.remove())","");
CM[K][CM[K].length]=new Array("重命名","javascript:void(T.rename())","");
