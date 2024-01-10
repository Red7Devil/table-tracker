var admin = require("firebase-admin");
var serviceAccount = require("./sdp3-firestore.json");
const Responses = require("./ApiResponses");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

exports.handler = async (event) => {
  try {
    const { restaurantId, view } = event.queryStringParameters;

    const reservations = await db
      .collection("RestaurantReservations")
      .where("restaurant_id", "==", restaurantId)
      .get();

    const aggregatedData = aggregateReservations(reservations.docs, view);

    return Responses._200({
      data: [...aggregatedData],
      message: "Retrieved hollistic data successfully",
    });
  } catch (error) {
    console.log(error);
    return Responses._400({
      message: "Error retrieving hollistic data",
      error: error.message,
    });
  }
};

function aggregateReservations(docs, view) {
  const reservationData = docs.map((doc) => ({
    ...doc.data(),
    reservation_date: new Date(doc.data().reservation_date.toMillis()), // Convert Firestore Timestamp to JavaScript Date
  }));

  // Depending on the view, group the data differently
  let groupedData;
  switch (view) {
    case "daily":
      groupedData = groupBy(
        reservationData,
        (date) => date.reservation_date.toISOString().split("T")[0]
      );
      break;
    case "weekly":
      const weeklyDefaultData = {};
      for (let day of daysOfWeek) {
        if (!weeklyDefaultData[day]) {
          weeklyDefaultData[day] = [];
        }
      }
      groupedData = groupBy(
        reservationData,
        (date) => getDayOfWeek(date.reservation_date),
        weeklyDefaultData
      );
      break;
    case "monthly":
      const monthlyDefaultData = {};
      for (let month of monthNames) {
        if (!monthlyDefaultData[month]) {
          monthlyDefaultData[month] = [];
        }
      }
      groupedData = groupBy(
        reservationData,
        (date) => getMonth(date.reservation_date),
        monthlyDefaultData
      );

      break;
    default:
      throw new Error("Invalid view type");
  }

  // Aggregate the data in each group
  return Object.keys(groupedData).map((key) => {
    const reservations = groupedData[key];
    const totalReservations = reservations.length;
    const totalTables = reservations.reduce(
      (sum, reservation) => sum + Math.ceil(reservation.required_capacity / 4),
      0
    );

    return { key, totalReservations, totalTables };
  });
}

function groupBy(array, keyFunction, defaultResult = {}) {
  return array.reduce((result, currentItem) => {
    const key = keyFunction(currentItem);
    if (!result[key]) {
      result[key] = [];
    }
    result[key].push(currentItem);
    return result;
  }, defaultResult);
}

const daysOfWeek = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function getDayOfWeek(date) {
  return daysOfWeek[date.getDay()];
}

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function getMonth(date) {
  // Returns the month name for grouping, e.g., "January", "February", etc.
  return monthNames[date.getMonth()];
}
