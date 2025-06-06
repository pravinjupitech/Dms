import mongoose from "mongoose";

const CustomerSchema = new mongoose.Schema({
  id: {
    type: String
  },
  sId:{
    type:String
  },
  userName: {
    type: String
  },
  created_by: {
    type: String
  },
  database: {
    type: String
  },
  rolename: {
    type: String
  },
  rolename1: {
    type: String
  },
  firstName: {
    type: String
  },
  lastName: {
    type: String
  },
  ownerName: {
    type: String
  },
  mobileNumber: {
    type: String
  },
  passPortNo: {
    type: String
  },
  aadharNo: {
    type: Number
  },
  panNo: {
    type: String
  },
  personalPincode: {
    type: Number
  },
  Pcity: {
    type: String
  },
  Pstate: {
    type: String
  },
  address: {
    type: String
  },
  Photo: {
    type: String
  },
  password: {
    type: String
  },
  geotagging: {
    type: String
  },
  category: {
    type: String
  },
  duedate: {
    type: Number
  },
  lockInTime: {
    type: Number
  },
  limit: {
    type: Number,
    default: 0
  },
  remainingLimit: {
    type: Number,
    default: 0
  },
  AdvanceAmount: {
    type: Number,
    default:0
  },
  paymentTerm: {
    type: String
  },
  transporterDetail: {
    type: String
  },
  assignTransporter: {
    type: []
  },
  serviceArea: {
    type: String
  },
  partyType: {
    type: String
  },
  registrationType: {
    type: String
  },
  gstNumber: {
    type: String
  },
  email: {
    type: String
  },
  dealsInProducts: {
    type: String
  },
  annualTurnover: {
    type: Number
  },
  CompanyName: {
    type: String
  },
  CompanyAddress: {
    type: String
  },
  comPanNo: {
    type: String
  },
  contactNumber: {
    type: Number
  },
  pincode: {
    type: Number
  },
  State: {
    type: String
  },
  City: {
    type: String
  },
  District:{
type:String
  },
  shopSize: {
    type: String
  },
  address1: {
    type: String
  },
  address2: {
    type: String
  },
  ownerAddress:{
type:String
  },
  bankDetails:[{
    Account_Name: {
      type: String
    },
    Account_No: {
      type: String
    },
    Ifsc_code: {
      type: String
    },
  }],
  shopPhoto: {
    type: []
  },
  OpeningBalance: {
    type: Number
  },
  Type: {
    type: String
  },
  status: {
    type: String,
    default: "Active"
  },
  otpVerify: {
    type: Number
  },
  autoBillingStatus: {
    type: String,
    default: "open"
  },
  latitude: {
    type: String
  },
  longitude: {
    type: String
  },
  loginDate: {
    type: String
  },
  currentAddress: {
    type: String
  },
  leadStatus: {
    type: String
  },
  leadStatusCheck: {
    type: String,
    default: "false"
  },
  group:{
    type:String
  },
  remark: [{
    remark:{
      type:String
    },
    date:{
      type:String
    },
    time:{
      type:String
    }
  }],
  dummyAmount: {
    type: Number,
    default: 0
  }

}, { timestamps: true });

export const Customer = mongoose.model("customer", CustomerSchema);