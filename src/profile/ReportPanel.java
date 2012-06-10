package profile;

import java.util.Arrays;

public class ReportPanel {

	public static long nanos[] = new long[255];
	public static int times[] = new int[255];
	public static boolean counting = true;
	
	public static void begin() {
		counting = true;
	}
	
	public static void reset() {
		Arrays.fill( nanos, 0 );
		Arrays.fill( times, 0 );
	}

	public static void end() {
		counting = false;
	}
	
	public static void setCapacity(int size) {
		nanos = new long[size];
		times = new int[size];
		reset();
	}
}
