package server.http;


public interface ContentResolver {
	public Content getContent(Request request);
	public Content error(Reply.Code code, String info);
}
