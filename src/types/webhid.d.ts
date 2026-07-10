export {};

declare global {
  interface HIDDeviceFilter {
    vendorId?: number;
    productId?: number;
    usagePage?: number;
    usage?: number;
  }

  interface HIDDeviceRequestOptions {
    filters: HIDDeviceFilter[];
    exclusionFilters?: HIDDeviceFilter[];
  }

  interface HIDReportInfo {
    reportId: number;
  }

  interface HIDCollectionInfo {
    outputReports?: HIDReportInfo[];
  }

  interface HIDDevice {
    readonly opened: boolean;
    readonly vendorId: number;
    readonly productId: number;
    readonly productName: string;
    readonly collections?: HIDCollectionInfo[];
    open: () => Promise<void>;
    close: () => Promise<void>;
    sendReport: (reportId: number, data: BufferSource) => Promise<void>;
  }

  interface HID {
    getDevices: () => Promise<HIDDevice[]>;
    requestDevice: (options: HIDDeviceRequestOptions) => Promise<HIDDevice[]>;
  }

  interface Navigator {
    readonly hid: HID;
  }
}
