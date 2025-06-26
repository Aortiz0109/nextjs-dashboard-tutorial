'use server';

import { z } from 'zod'; // Import the zod library for schema validation
import { revalidatePath } from 'next/cache'; // Import the revalidatePath function from next/cache
import { redirect } from 'next/navigation'; // Import the redirect function from next/navigation
import postgres from 'postgres'; // Import the postgres library for database operations

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' }); // Initialize the postgres library with the database URL and SSL settings

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({ 
    invalid_type_error: 'Please select a customer.',
  }),
  amount: z.coerce.number()
  .gt(0, {message: 'Please enter an amount greater than $0.'}),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select an invoice status.',
  }),
  date: z.string(),
}); // Define the schema for the form data

const CreateInvoice = FormSchema.omit({ id: true, date: true }); // Define the schema for the form data.
const UpdateInvoice = FormSchema.omit({ id: true, date: true }); // Define the schema for the form data used in updating an invoice.

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
}; // Define the state type for the form data

export async function createInvoice(prevState: State, formData: FormData) {
  // Validate form fields using Zod
  const validatedFields = CreateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });
 
  // If form validation fails, return errors early. Otherwise, continue.
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Create Invoice.',
    };
  }
  const { customerId, amount, status } = CreateInvoice.parse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  }); // Parse the form data and extract the required fields
  const amountInCents = amount * 100; // Convert the amount to cents for storage
  const date = new Date().toISOString().split('T')[0]; // Get the current date in YYYY-MM-DD format

  try {
    await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `; // Insert the invoice into the database
  } catch (error) {
    console.error('Error creating invoice:', error); // Log any errors thatoccur during the creation process
  }

  revalidatePath('/dashboard/invoices'); // Revalidate the invoices page to reflect the new invoice
  redirect('/dashboard/invoices'); // Redirect to the invoices page after successful creation
}

export async function updateInvoice(id: string, prevState: State, formData: FormData) {
  // Validate form fields using Zod
  const validatedFields = UpdateInvoice.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });
  // If form validation fails, return errors early. Otherwise, continue.
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. Failed to Update Invoice.',
    };
  }

  const { customerId, amount, status } = UpdateInvoice.parse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  }); // Parse the form data and extract the required fields
  const amountInCents = amount * 100; // Convert the amount to cents for storage
  
  try {
    await sql`
    UPDATE invoices
    SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
    WHERE id = ${id}
    `; // Update the invoice in the database
  } catch (error) {
    console.error('Error updating invoice:', error); // Log any errors that occur during the update process
  }

  revalidatePath('/dashboard/invoices'); // Revalidate the invoices page to reflect the updated invoice
  redirect('/dashboard/invoices'); // Redirect to the invoices page after successful update
}

export async function deleteInvoice(id: string) {
  throw new Error('Failed to Delete Invoice');
    await sql`
    DELETE FROM invoices
    WHERE id = ${id}
  `; // Delete the invoice from the database
    revalidatePath('/dashboard/invoices'); // Revalidate the invoices page to reflect the deleted invoice
}
