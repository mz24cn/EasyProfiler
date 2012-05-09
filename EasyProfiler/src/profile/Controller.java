package profile;

import java.io.ByteArrayOutputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.InputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.lang.instrument.Instrumentation;
import java.lang.reflect.Method;
import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.Charset;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;

import com.sun.jdi.connect.IllegalConnectorArgumentsException;

import javassist.CannotCompileException;
import javassist.ClassPool;
import javassist.CtClass;
import javassist.CtMethod;
import javassist.NotFoundException;
import javassist.util.HotSwapper;
import server.http.ChannelIO;
import server.http.Content;
import server.http.ContentResolver;
import server.http.Reply.Code;
import server.http.Request;
import server.http.Server;

public class Controller implements ContentResolver {

	static Controller instance = null;
	Instrumentation instru;
	ClassPool pool;
	HotSwapper swapper = null;
	Map<String, byte[]> originalClasses;
	Map<String, Integer> profileMethods;
	int profileCount;
	Class<?> loadedClasses[] = null;
	int portJDWP;

	Controller(int portJDWP, int portHTTP, Instrumentation inst) throws Exception {
		instru = inst;
		pool = ClassPool.getDefault();
		originalClasses = new HashMap<String, byte[]>();
		profileMethods = new LinkedHashMap<String, Integer>();
		profileCount = 0;
		this.portJDWP = portJDWP;

		Server httpServer = new Server(portHTTP, 1024, false);
		httpServer.runServer(this);
	}

	public static void premain(String agentArgs, Instrumentation inst) {
		String ports[] = agentArgs.split(",");
		try {
			instance = new Controller(new Integer(ports[0]), new Integer(ports[1]), inst);
		} catch (Exception e) {
			e.printStackTrace();
		}
		System.out.println("Easy Profiler listening at: " + ports[1]);
	}

	public static void agentmain(String agentArgs, Instrumentation inst) {
		if (instance == null)
			premain(agentArgs, inst);
	}

	public static void main(String args[]) throws NumberFormatException, IOException, IllegalConnectorArgumentsException {
		HotSwapper swapper = new HotSwapper(new Integer(args[0]));
		System.out.println(swapper + " successfully connects with Hotswap JVM at port "+args[0]);
	}
	
	@Override
	public Content getContent(Request request) {
		String path = request.URI().toString();
		if (path.equals("/tree")) {
			String DO = request.getParameter("do");
			if (DO.equals("list"))
				return new StringContent(getClassList(request.getParameter("dir")), "text/xml");
			else if (DO.equals("check"))
				return new StringContent(checkClassMethod(request.getParameter("node"),
						new Boolean(request.getParameter("switch"))), "text/xml");
			else if (DO.equals("image"))
				return new ResourceContent(request.getParameter("file"));
			else
				return new StringContent("FAIL");
		} else if (path.equals("/report"))
			return new StringContent(getReport(), "text/html");
		else if (path.equals("/reload")) {
			loadClasses();
			return new StringContent("<script>window.location='/tree.htm'</script>", "text/html");
		} else if (path.equals("/reset")) {
			ReportPanel.reset();
			return new StringContent("<script>window.location='/report'</script>", "text/html");
		} else if (path.equals("/"))
			return new ResourceContent("frame.htm");

		return new ResourceContent(path.substring(1));
	}

	public String checkClassMethod(String node, boolean isSwitch) {
		String longName = node.substring(1).replace('/', '.');
		node = longName.substring(0, node.indexOf('('));
		String className = node.substring(0, node.lastIndexOf('.'));
		StringBuffer buffer = new StringBuffer();
		buffer.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\r\n");
		try {
			CtClass cc = null;
			try {
				cc = pool.get(className);
			} catch (NotFoundException e) {
				int i = 0, j = loadedClasses.length, n;
				while (true) {
					n = (i + j) >> 1;
					int result = loadedClasses[n].getName().compareTo(className);
					if (result < 0)
						i = n;
					else if (result > 0)
						j = n;
					else
						break;
				}
				Class<?> clazz = loadedClasses[n];
				String path = clazz.getProtectionDomain().getCodeSource().getLocation().getFile();
				pool.appendClassPath(path);
				cc = pool.get(className);
			}
			CtMethod CMs[] = cc.getDeclaredMethods(), theMethod = null;
			for (CtMethod method : CMs) {
				if (method.getLongName().equals(longName)) {
					theMethod = method;
					break;
				}
			}
			if (originalClasses.get(className) == null)
				originalClasses.put(className, cc.toBytecode());
			cc.defrost();
			int order = profileCount;
			theMethod.addLocalVariable("__t", pool.get("long"));
			if (isSwitch) {
				theMethod.insertBefore("{profile.ReportPanel.begin(); __t = System.nanoTime(); profile.ReportPanel.times["
						+ order + "]++;}");
				theMethod.insertAfter("{profile.ReportPanel.nanos[" + order
						+ "] += System.nanoTime() - __t; profile.ReportPanel.end();}");
			} else {
				theMethod
						.insertBefore("{__t = System.nanoTime(); if (profile.ReportPanel.counting) profile.ReportPanel.times["
								+ order + "]++;}");
				theMethod.insertAfter("{if (profile.ReportPanel.counting) {profile.ReportPanel.nanos[" + order
						+ "] += System.nanoTime() - __t;}}");
			}
			cc.freeze();
			byte[] classFile = cc.toBytecode();
			if (swapper == null) {
				swapper = new HotSwapper(portJDWP);
				System.out.println("Easy Profiler connects JDWP at: " + portJDWP);
			}
			swapper.reload(className, classFile);
			profileMethods.put(longName, order);
			profileCount++;
			System.out.println("profiling: " + longName);
			buffer.append("<File>\r\n<Status>true</Status>\r\n</File>");
		} catch (NotFoundException e) {
			StringWriter sw = new StringWriter();
			e.printStackTrace(new PrintWriter(sw));
			buffer.append("<File>\r\n<Status>false</Status>\r\n<Reason>").append(e.toString()).append("</Reason>\r\n<Advice>")
					.append(sw.toString()).append("</Advice>\r\n</File>");
		} catch (IOException e) {
			StringWriter sw = new StringWriter();
			e.printStackTrace(new PrintWriter(sw));
			buffer.append("<File>\r\n<Status>false</Status>\r\n<Reason>").append(e.toString()).append("</Reason>\r\n<Advice>")
					.append(sw.toString()).append("</Advice>\r\n</File>");
		} catch (CannotCompileException e) {
			StringWriter sw = new StringWriter();
			e.printStackTrace(new PrintWriter(sw));
			buffer.append("<File>\r\n<Status>false</Status>\r\n<Reason>").append(e.toString()).append("</Reason>\r\n<Advice>")
					.append(sw.toString()).append("</Advice>\r\n</File>");
		} catch (Exception e) {
			StringWriter sw = new StringWriter();
			e.printStackTrace(new PrintWriter(sw));
			buffer.append("<File>\r\n<Status>false</Status>\r\n<Reason>").append(e.toString()).append("</Reason>\r\n<Advice>")
					.append(sw.toString()).append("</Advice>\r\n</File>");
		} catch (Error e) {
			StringWriter sw = new StringWriter();
			e.printStackTrace(new PrintWriter(sw));
			buffer.append("<File>\r\n<Status>false</Status>\r\n<Reason>").append(e.toString()).append("</Reason>\r\n<Advice>")
					.append(sw.toString()).append("</Advice>\r\n</File>");
		}
		return buffer.toString();
	}

	public void loadClasses() {
		loadedClasses = instru.getAllLoadedClasses();
		Arrays.sort(loadedClasses, new Comparator<Class<?>>() {

			@Override
			public int compare(Class<?> o1, Class<?> o2) {
				return o1.getName().compareTo(o2.getName());
			}

		});
	}

	public String getClassList(String path) {
		String packageName = path.substring(1).replace('/', '.');
		if (loadedClasses == null)
			loadClasses();
		StringBuffer buffer = new StringBuffer();
		HashSet<String> packages = new HashSet<String>();
		buffer.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>");
		buffer.append("<Node>\r\n<Attrib name='ÃèÊö' id='detail' type='string'/>\r\n");

		for (Class<?> clazz : loadedClasses) {
			String name = clazz.getName();
			if (name.charAt(0) == '[' || name.charAt(0) == '$')
				continue;
			boolean isInterface = clazz.isInterface();
			int n = name.lastIndexOf('.');
			if (n < 0) {
				if (packageName.length() == 0)
					buffer.append("<Node expand='true' id=\"" + name + "\" type=\"class\"/>\r\n");
				continue;
			}
			if (packageName.length() == 0) {
				String pack = name.substring(0, name.indexOf('.'));
				if (!packages.contains(pack)) {
					packages.add(pack);
					buffer.append("<Node expand='true' id=\"" + pack + "\" type=\"package\"/>\r\n");
				}
			} else if (name.startsWith(packageName)) {
				if (name.length() == packageName.length()) { // expand class
					Method[] methods = clazz.getDeclaredMethods();
					for (Method method : methods) {
						String methodStr = method.toString();
						int j = methodStr.indexOf('('), k = methodStr.indexOf(')', j) + 1;
						String paramStr = methodStr.substring(j, k);
						buffer.append("<Node checkbox='true' ");
						if (isInterface)
							buffer.append("disabled='true' ");
						buffer.append("expand='false' detail='").append(methodStr);
						buffer.append("' id=\"" + method.getName() + paramStr + "\" type=\"method\"/>\r\n");
					}
				} else if (name.charAt(packageName.length()) == '.') {
					n = name.indexOf('.', packageName.length() + 2);
					if (n < 0) // class
						buffer.append("<Node expand='true' id=\"" + name.substring(packageName.length() + 1)
								+ "\" type=\"class\"/>\r\n");
					else {
						String pack = name.substring(packageName.length() + 1, n);
						if (!packages.contains(pack)) {
							packages.add(pack);
							buffer.append("<Node expand='true' id=\"" + pack + "\" type=\"package\"/>\r\n");
						}
					}
				}
			}
		}
		buffer.append("</Node>");
		return buffer.toString();
	}

	public String getReport() {
		StringBuffer buffer = new StringBuffer();
		buffer.append("<html><head></head><body><style>body {font-family:'Arial Narrow';font-size:12px; color:#000000; background-color:#FFFFF;}\r\n.menu {border:1px solid #0000FF; background-color:#FFFFFF; display: none}\r\n.detail {position:absolute; width:450px; z-index:1; display: none}</style>");
		buffer.append("<div width='32' style='float:right'><a href='/report'><img border='0' src='refresh.gif'/></a></div>");
		buffer.append("<h2>Profile Report</h2>");
		buffer.append(new Date()).append(" <a href='/reset'>reset data</a> ");
		if (ReportPanel.counting)
			buffer.append(" <b>counting...</b>");
		buffer.append("<table width='100%'>");
		buffer.append("<tr><td><b>Profile Method</b></td><td><b>Run Time(ms)</b></td><td><b>Call Times</b></td></tr>");
		for (String longName : profileMethods.keySet()) {
			int n = profileMethods.get(longName);
			long nano = ReportPanel.nanos[n];
			int times = ReportPanel.times[n];
			String ms = String.format("%.2f", nano / 1000000F);
			n = longName.indexOf('(');
			int j = longName.lastIndexOf('.', n);
			j = longName.lastIndexOf('.', j-1) + 1;
			String simpleName = longName.substring(j, n);
			buffer.append("<tr><td onMouseOver=\"parent.leftFrame.T.showDetail(this,'").append(longName).append("')\" onMouseOut=\"parent.leftFrame.T.closeDetail(this)\">").append(simpleName).append("</td><td>").append(ms).append("</td><td>").append(times)
					.append("</td></tr>");
		}
		buffer.append("</table><div id=\"//detail\" class=\"menu detail\"></body></html>");
		return buffer.toString();
	}

	@Override
	public Content error(Code code, String info) {
		return new StringContent(info);
	}

	Charset defaultCharset = Charset.forName("UTF-8");

	class StringContent implements Content {

		private String type; // MIME type
		private String content;

		StringContent(CharSequence c, String t) {
			content = c.toString();
			if (!content.endsWith("\n"))
				content += "\n";
			type = t + "; charset=UTF-8";
		}

		StringContent(CharSequence c) {
			this(c, "text/plain");
		}

		StringContent(Exception x) {
			StringWriter sw = new StringWriter();
			x.printStackTrace(new PrintWriter(sw));
			type = "text/plain; charset=UTF-8";
			content = sw.toString();
		}

		public String type() {
			return type;
		}

		private ByteBuffer bb = null;

		private void encode() {
			if (bb == null)
				bb = defaultCharset.encode(CharBuffer.wrap(content));
		}

		public long length() {
			encode();
			return bb.remaining();
		}

		public void prepare() {
			encode();
			bb.rewind();
		}

		public boolean send(ChannelIO cio) throws IOException {
			if (bb == null)
				throw new IllegalStateException();
			cio.write(bb);

			return bb.hasRemaining();
		}

		public void release() throws IOException {
		}

		@Override
		public String header() {
			return null;
		}
	}

	class ResourceContent implements Content {

		String filename;
		private ByteBuffer bb = null;

		ResourceContent(String file) {
			filename = file;
		}

		private String type = null;

		public String type() {
			if (type != null)
				return type;
			if (filename.endsWith(".htm"))
				type = "text/html;";
			else if (filename.endsWith(".gif"))
				type = "image/gif";
			else
				type = "text/plain";
			return type;
		}

		public long length() {
			return bb.remaining();
		}

		public void prepare() throws IOException {
			ByteArrayOutputStream baos = new ByteArrayOutputStream(2048);
			InputStream is = this.getClass().getResourceAsStream("/" + filename);
			if (is == null)
				throw new FileNotFoundException(filename);
			byte[] buffer = new byte[2048];
			int n;
			try {
				while ((n = is.read(buffer)) >= 0)
					baos.write(buffer, 0, n);
			} catch (IOException e) {
			}
			bb = ByteBuffer.allocate(baos.size());
			bb.put(baos.toByteArray());
			bb.flip();
		}

		public boolean send(ChannelIO cio) throws IOException {
			cio.write(bb);
			return bb.hasRemaining();
		}

		public void release() throws IOException {
		}

		@Override
		public String header() {
			if (filename.endsWith(".gif"))
				return "Cache-Control: max-age=86400";
			else
				return null;
		}
	}
}
