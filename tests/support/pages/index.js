import { AuthorizedsPage } from "./authorizeds.page";
import { ContactsPage } from "./contacts.page";
import { EmployeeCreatePage, EmployeesPage } from "./employees.page";
import { ProductsPage } from "./products.page";

const SCREENS = {
  authorizeds: AuthorizedsPage,
  contacts: ContactsPage,
  products: ProductsPage,
  employees: EmployeesPage,
  employeesCreate: EmployeeCreatePage,
};

/** Devolve o Page Object da tela (authorizeds, contacts, products, employees ou employeesCreate). */
export const pageFor = (screen) => new SCREENS[screen]();
