import { ActivityLog } from "../model/activityLog.model.js";

export const AddLog = async (req, res, next) => {
    try {
        const sessionId = Date.now() + "-" + req.body.userId;

        const log = await ActivityLog.create({
            ...req.body,
            sessionId
        });
        return log ? res.status(200).json({
            message: "Data Saved",
            status: true,
            sessionId
        }) : res.status(404).json({ message: "Something Went Wrong", status: false })
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", status: false })
    }
}

export const updateLogTime = async (req, res, next) => {
    try {
        const { sessionId, logOutTime } = req.body;

        const log = await ActivityLog.findOne({ sessionId });

        if (!log) {
            return res.status(404).json({
                message: "Session not found",
                status: false
            });
        }

        log.logOutTime = logOutTime;
        await log.save();

        return res.status(200).json({
            message: "Logout time saved",
            status: true
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            message: "Internal Server Error",
            status: false
        });
    }
};


export const viewLogs = async (req, res, next) => {
    try {
        const { database } = req.params;
        const logs = await ActivityLog.find({ database: database });
        return logs.length > 0 ? res.status(200).json({ message: "Data Found", logs, status: true }) : res.status(404).json({ message: "Not Found", status: false })
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", status: false })
    }
}

export const checkPincode =async (req, res) => {
  try {
    const { lat, log } = req.body;

    if (!lat || !log) {
      return res
        .status(400)
        .json({ message: "Latitude and Longitude required", status: false });
    }

    const getPincodeFromLocationIQ = async (lat, lon) => {
    try {
    const url = `https://us1.locationiq.com/v1/reverse?key=pk.60c684b42995cc248db8034396d610f2&lat=${lat}&lon=${lon}&format=json`;

      const res = await fetch(url);
      const data = await res.json();

      return {
        city:
          data?.address?.state_district ||
          data?.address?.town ||
          data?.address?.village ||
          data?.address?.district ||
          data?.address?.city
 ||
          "Unknown",

        pincode: data?.address?.postcode || "—",
        data
      };
    } catch (error) {
      console.log("LocationIQ Error:", error);
      return { city: "Unknown", pincode: "—" };
    }
  };
    const pincode = await getPincodeFromLocationIQ(lat, log);

    if (!pincode) {
      return res
        .status(404)
        .json({ message: "Pincode not found", status: false });
    }

    return res.status(200).json({ pincode, status: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error", status: false });
  }
};

export const deleteAllLogs = async (req, res, next) => {
    try {
        const { logs } = req.body;

        if (!Array.isArray(logs) || logs.length === 0) {
            return res.status(400).json({ message: "No logs provided", status: false });
        }

        await ActivityLog.deleteMany({ _id: { $in: logs } });

        return res.status(200).json({ message: "Deleted Successfully", status: true });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", status: false })
    }
}

export const deleteLog = async (req, res, next) => {
    try {
        const { id } = req.params;
        const log = await ActivityLog.findByIdAndDelete(id);
        return log ? res.status(200).json({ message: "Data Deleted", status: true }) : res.status(404).json({ message: "Something Went Wrong", status: false })
    } catch (error) {
        console.log(error);
        return res.status(500).json({ message: "Internal Server Error", status: false })
    }
}