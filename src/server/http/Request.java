package server.http;

/*
 * @(#)Request.java	1.3 05/11/17
 * 
 * Copyright (c) 2006 Sun Microsystems, Inc. All Rights Reserved.
 * 
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 * 
 * -Redistribution of source code must retain the above copyright notice, this
 *  list of conditions and the following disclaimer.
 * 
 * -Redistribution in binary form must reproduce the above copyright notice, 
 *  this list of conditions and the following disclaimer in the documentation
 *  and/or other materials provided with the distribution.
 * 
 * Neither the name of Sun Microsystems, Inc. or the names of contributors may 
 * be used to endorse or promote products derived from this software without 
 * specific prior written permission.
 * 
 * This software is provided "AS IS," without a warranty of any kind. ALL 
 * EXPRESS OR IMPLIED CONDITIONS, REPRESENTATIONS AND WARRANTIES, INCLUDING
 * ANY IMPLIED WARRANTY OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE
 * OR NON-INFRINGEMENT, ARE HEREBY EXCLUDED. SUN MIDROSYSTEMS, INC. ("SUN")
 * AND ITS LICENSORS SHALL NOT BE LIABLE FOR ANY DAMAGES SUFFERED BY LICENSEE
 * AS A RESULT OF USING, MODIFYING OR DISTRIBUTING THIS SOFTWARE OR ITS
 * DERIVATIVES. IN NO EVENT WILL SUN OR ITS LICENSORS BE LIABLE FOR ANY LOST 
 * REVENUE, PROFIT OR DATA, OR FOR DIRECT, INDIRECT, SPECIAL, CONSEQUENTIAL, 
 * INCIDENTAL OR PUNITIVE DAMAGES, HOWEVER CAUSED AND REGARDLESS OF THE THEORY 
 * OF LIABILITY, ARISING OUT OF THE USE OF OR INABILITY TO USE THIS SOFTWARE, 
 * EVEN IF SUN HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
 * 
 * You acknowledge that this software is not designed, licensed or intended
 * for use in the design, construction, operation or maintenance of any
 * nuclear facility.
 */

import java.io.UnsupportedEncodingException;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLDecoder;
import java.nio.ByteBuffer;
import java.nio.CharBuffer;
import java.nio.charset.Charset;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * An encapsulation of the request received.
 * <P>
 * The static method parse() is responsible for creating this object.
 * 
 * @author Mark Reinhold
 * @author Brad R. Wetmore
 * @version 1.3, 05/11/17
 */
public class Request {

	/**
	 * A helper class for parsing HTTP command actions.
	 */
	static class Action {

		private String name;

		private Action(String name) {
			this.name = name;
		}

		public String toString() {
			return name;
		}

		static Action GET = new Action("GET");
		static Action PUT = new Action("PUT");
		static Action POST = new Action("POST");
		static Action HEAD = new Action("HEAD");

		static Action parse(String s) {
			if (s.equals("GET"))
				return GET;
			if (s.equals("PUT"))
				return PUT;
			if (s.equals("POST"))
				return POST;
			if (s.equals("HEAD"))
				return HEAD;
			throw new IllegalArgumentException(s);
		}
	}

	private Action action;
	private String version;
	private URI uri;
	private Map<String, String> parameters = null;
	private Socket socket;

	Action action() {
		return action;
	}

	String version() {
		return version;
	}

	public URI URI() {
		return uri;
	}

	private Request(Action a, String v, URI u, String q) {
		action = a;
		version = v;
		uri = u;
		if (q != null) {
			parameters = new HashMap<String, String>();
			String tmp[] = q.split("&");
			for (String tmp2 : tmp) {
				String tmp3[] = tmp2.split("=");
				String name=tmp3[0], value="";
				try {
					if (tmp3.length > 1)
						value = URLDecoder.decode(tmp3[1], "UTF-8");
				}
				catch (UnsupportedEncodingException e) {
	            }
				parameters.put(name, value);
			}
		}
	}

	public void setSocket(Socket socket) {
		this.socket = socket;
	}
	
	public String getParameter(String name) {
		if (parameters != null)
			return parameters.get(name);
		else
			return null;
	}
	
	public Socket getSocket() {
		return socket;
	}
	
	public String getRemoteAddr()
	{
		return ((InetSocketAddress)socket.getRemoteSocketAddress()).getAddress().getHostAddress();	
	}
	
	public String toString() {
		return (action + " " + version + " " + uri);
	}

	static boolean isComplete(ByteBuffer bb) {
		int p = bb.position() - 4;
		if (p < 0)
			return false;
		return (((bb.get(p + 0) == '\r') && (bb.get(p + 1) == '\n')
				&& (bb.get(p + 2) == '\r') && (bb.get(p + 3) == '\n')));
	}

	public static Charset ascii = Charset.forName("UTF-8");

	/*
	 * The expected message format is first compiled into a pattern, and is then
	 * compared against the inbound character buffer to determine if there is a
	 * match. This convienently tokenizes our request into usable pieces.
	 * 
	 * This uses Matcher "expression capture groups" to tokenize requests like:
	 * 
	 * GET /dir/file HTTP/1.1 Host: hostname
	 * 
	 * into:
	 * 
	 * group[1] = "GET" group[2] = "/dir/file" group[3] = "1.1" group[4] =
	 * "hostname"
	 * 
	 * The text in between the parens are used to captured the regexp text.
	 */
	private static Pattern requestPattern = Pattern.compile(
			"\\A([A-Z]+) +([^ ]+) +HTTP/([0-9\\.]+)$"
					+ ".*^Host: ([^ ]+)$.*\r\n\r\n\\z", Pattern.MULTILINE
					| Pattern.DOTALL);

	static Request parse(ByteBuffer bb) throws MalformedRequestException {

		CharBuffer cb = ascii.decode(bb);
		Matcher m = requestPattern.matcher(cb);
		if (!m.matches())
			throw new MalformedRequestException();
		Action a;
		try {
			a = Action.parse(m.group(1));
		} catch (IllegalArgumentException x) {
			throw new MalformedRequestException();
		}
		URI u;
		String q = null;
		try {
			String uri = m.group(2);
			int n = uri.indexOf('?');
			if (n >= 0)
				q = uri.substring(n+1);
			u = new URI(n>=0? uri.substring(0, n) : uri);
		} catch (URISyntaxException x) {
			throw new MalformedRequestException();
		}
		return new Request(a, m.group(3), u, q);
	}
}
