"use server"

import { ID, Query } from "node-appwrite"
import { APPOINTMENT_COLLECTION_ID, DATABASE_ID, databases, messaging } from "../appwrite.config"
import { formatDateTime, parseStringify } from "../utils"
import { scheduler } from "timers/promises"
import { Appointment } from "@/types/appwrite.types"
import { revalidatePath } from "next/cache"

export const createAppointment = async (appointment: CreateAppointmentParams) => {
  try{
    const newAppointment = await databases.createDocument(
      DATABASE_ID!,
      APPOINTMENT_COLLECTION_ID!,
      ID.unique(),
      appointment
    )  
      
    return parseStringify(newAppointment)
  }catch(error){
    console.log(error)
  }
}

export const getAppointment = async (appointmentId: string) => {
  try{
    const appointment = await databases.getDocument(
      DATABASE_ID!,
      APPOINTMENT_COLLECTION_ID!,

      appointmentId,
    )
    return parseStringify(appointment)
  }catch(error){
    console.log(error)
  }
}

export const getRecentAppointmentList = async() =>{
  try{
    const appointments = await databases.listDocuments(
      DATABASE_ID!,
      APPOINTMENT_COLLECTION_ID!,
      [Query.orderDesc('$createdAt')]
    )

    const initialCounts={
      scheduledCount:0,
      pendingCount:0,
      cancelledCount:0,
    }

    const counts = (appointments.documents as Appointment[]).reduce((acc,appointments) =>{
      if (appointments.status === 'scheduled'){
        acc.scheduledCount +=1
      } else if (appointments.status === 'pending'){
        acc.pendingCount +=1
      } else if (appointments.status === 'cancelled'){
        acc.cancelledCount +=1
      }
      return acc
    }, initialCounts)

    const data = {
      totalCount: appointments.total,
      ...counts,
      documents: appointments.documents
    }
    
    return parseStringify(data)
  }catch(error){
    console.log(error)
  }
}

export const updateAppointment = async ({
  appointmentId,
  userId,
  appointment,
  type,
}: UpdateAppointmentParams) => {
  try {
    if (!appointmentId) {
      throw new Error("Missing appointmentId");
    }

    // 🔒 NORMALIZE RELATIONSHIPS (CRITICAL)
    if (Array.isArray(appointment.primaryPhysician)) {
      appointment.primaryPhysician = appointment.primaryPhysician[0];
    }

    if (Array.isArray(appointment.patient)) {
      appointment.patient = appointment.patient[0];
    }

    const updatedAppointment = await databases.updateDocument(
      DATABASE_ID!,
      APPOINTMENT_COLLECTION_ID!,
      appointmentId,
      appointment
    );

    if (!updatedAppointment) {
      throw new Error("Appointment not found");
    }

    const smsMessage = `
      Hi, it's CarePulse.
      ${
        type === "schedule"
          ? `Your appointment has been scheduled for ${
              formatDateTime(appointment.schedule!).dateTime
            } with Dr. ${appointment.primaryPhysician}`
          : `We regret to inform you that your appointment has been cancelled. Reason: ${
              appointment.cancellationReason
            }`
      }
    `;

    await sendSMSNotification(userId, smsMessage);

    revalidatePath("/admin");
    return parseStringify(updatedAppointment);
  } catch (error) {
    console.error(error);
    throw error;
  }
};


export const sendSMSNotification = async (userId: string, content: string) => {
  try{
    const message = await messaging.createSMS(
      ID.unique(),
      content,
      [],
      [userId]
    )
    
    return parseStringify(message);
  } catch(error){
    console.log(error)
  }
}